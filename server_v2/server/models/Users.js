/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import { log } from 'console';
import { aql } from 'arangojs';
import { isEmail, isLength, isAlphanumeric } from 'validator';
import { https } from 'request-easy';
import admin from './admin';
import env from '../config/config';
import DB from '../config/db';
import ArangoDataSource from './arangoDatasource/arangoDatasource';

// eslint-disable-next-line no-unused-vars
const signInWithProviderHost = 'identitytoolkit.googleapis.com';
// eslint-disable-next-line no-unused-vars
const signInWithProviderPath = `/v1/accounts:signInWithIdp?key=${env.FIREBASE_API_KEY}`;

const signInWithEmailHost = 'identitytoolkit.googleapis.com';
const signInWithEmailPath = `/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`;

export default class Users extends ArangoDataSource {
  constructor() {
    super(DB);
    this.usersCol = DB.collection('Users');
    this.followsCol = DB.edgeCollection('Follows');
    this.likeCol = DB.edgeCollection('Like');
  }

  async signupWithEmail({ email, password, username }) {
    if (!isEmail(email)) {
      throw new Error('Invalid Email');
    } else if (!isLength(password, 6)) {
      throw new Error('Password must be atleast 6 characters long');
    } else if (!isLength(username, 3)) {
      throw new Error('Username must be 3 characters or more');
    } else if (!isAlphanumeric(username)) {
      throw new Error('Username can not contain special characters');
    } else {
      const users = this.usersCol;
      const exist = await users.firstExample({ email }).catch(() => false);
      const exist2 = await users.firstExample({ username }).catch(() => false);
      if (exist) {
        throw new Error('The email address is already in use by another account');
      } else if (exist2) {
        throw new Error('The Username is already in use by another account');
      } else {
        return this._createUserWithEmail(email, password, username)
          .then((user) => users.save({
            _key: user.uid,
            username: user.displayName,
            disabled: user.disabled,
            email: user.email,
            emailVerified: user.emailVerified,
            avator: user.photoURL,
            role: 1,
          })).then(async (user) => {
            const setClaims = await this._setUserClaims(user);
            if (setClaims) {
              const session = await this.signInWithEmail({ email, password })
                // .then(({ idToken }) => this.createSessionToken(idToken))
                .catch((e) => e);
              if (session instanceof Error) {
                throw session;
              }
              // return users.document(user).then((u) => ({token }));
              return session;
            }

            const remove1 = await admin.auth()
              .deleteUser(user._key).then(() => true).catch(() => false);
            const remove2 = await users.remove(user)
              .then(() => true).catch(() => false);
            if (remove1 && remove2) {
              throw Error('Failed to create user account');
            } else throw Error('Failed to cleanup user signup errors');
          }).then((user) => user);
      }
    }
  }

  signInWithEmail({ email, password }) {
    // eslint-disable-next-line new-cap
    const request = new https({
      hostname: signInWithEmailHost,
    });
    const returnSecureToken = true;
    // eslint-disable-next-line new-cap
    const buffer = new Buffer.from(JSON.stringify({ email, password, returnSecureToken }));
    return request.asyncPost({ path: signInWithEmailPath, buffer })
      // eslint-disable-next-line no-unused-vars
      .then(async ([status, headers, body]) => {
        if (status === 200) {
          const credential = JSON.parse(body);
          log(credential);
          const { idToken } = credential;
          const session = await this.createSessionToken(idToken).catch((e) => e);
          if (session instanceof Error) {
            throw session;
          }
          return session;
          // this.collection.document(localId).then((user) => ({ user, sessionToken }));
        }
        throw Error(body);
      });
  }

  _createUserWithEmail(email, password, username) {
    return admin.auth().createUser({
      email,
      emailVerified: false,
      // phoneNumber: '+11234567890',
      password,
      displayName: username,
      // photoURL: 'http://www.example.com/12345678/photo.png',
      disabled: false,
    });
  }

  _setUserClaims(user) {
    return admin.auth()
      // eslint-disable-next-line no-underscore-dangle
      .setCustomUserClaims(user._key, { linked: true, role: 1, _key: user._key })
      .then(() => true).catch(() => false);
  }

  createSessionToken(idToken, expiresIn = 60 * 60 * 5 * 24 * 1000) {
    return admin.auth()
      .verifyIdToken(idToken, true)
      .then((decodedIdToken) => {
        // Only process if the user just signed in in the last 5 minutes.
        if (new Date().getTime() / 1000 - decodedIdToken.auth_time < 5 * 60) {
          // Create session cookie and return it.
          return admin.auth().createSessionCookie(idToken, { expiresIn })
            // eslint-disable-next-line arrow-body-style
            .then((sessionToken) => {
              return this.usersCol.document(decodedIdToken.uid)
              // eslint-disable-next-line arrow-body-style
                .then((user) => { return { user, sessionToken, message: 'Session created successfully' }; });
            });
        }
        throw Error('A user that was not recently signed in is trying to set a session');
      });
  }

  destroySessionToken(sessionToken) {
    return admin.auth()
      .verifySessionCookie(sessionToken)
      .then((decodedClaims) => admin.auth()
        .revokeRefreshTokens(decodedClaims.sub))
      .then(() => ({ status: true, message: 'Session destroyed successfully' }));
  }


  linkIdProvider({ idToken, username }) {
    log(idToken);
    log(username);
    if (!idToken) {
      throw new Error('No id token provided');
    } else if (!username) {
      throw new Error('No username provided');
    } else {
    // eslint-disable-next-line no-unused-vars
      const [bearer, token] = idToken.split(' ');
      return admin.auth().verifyIdToken(token, true)
        .then(async (info) => {
          const {
            linked, role, _key, uid,
          } = info;

          if (linked && role && _key === uid) {
            throw new Error('Provided token is already linked to a user');
          } else if (!isLength(username, 3)) {
            throw new Error('Username must be 3 characters or more');
          } else if (!isAlphanumeric(username)) {
            throw new Error('Username can not contain special characters');
          } else {
            const user = await admin.auth().getUser(uid).catch((error) => error);
            if (user instanceof Error) {
              throw new Error('Failed to get user account');
            } else {
              const {
                email, displayName, photoURL, phoneNumber, disabled, emailVerified,
              } = user;

              const users = DB.collection('Users');
              const exist = await users.firstExample({ email }).catch(() => false);
              const exist2 = await users.firstExample({ username }).catch(() => false);
              if (exist) {
              // Todo handle case were user is in database and firebase but has no claims set
                throw new Error('The email address is already in use by another account');
              } else if (exist2) {
                throw new Error('The Username is already in use by another account');
              } else {
              // link user here
                const auser = await users.save({
                  _key: uid,
                  username,
                  displayName,
                  phoneNumber,
                  disabled,
                  email,
                  emailVerified,
                  avator: photoURL,
                  role: 1,
                }).catch((error) => error);

                if (auser instanceof Error) {
                  throw new Error(auser.message || 'Failed to create user account');
                } else {
                // set claims here
                  const setClaims = await this._setUserClaims(auser);
                  if (setClaims) {
                    const data = await users.document(auser).catch((error) => error);
                    if (data instanceof Error) {
                      throw new Error('Failed to get user info with session');
                    } else {
                      return { user: data, message: 'Account linked successfully' };
                    }
                  }
                }
              }
            }
          }
          return null;
        });
    }
  }

  async updateProfile(user, {
    username, avator, displayName, email, phoneNumber, cover,
  }) {
    if (!user._id) throw Error('User is not logged in');
    const userData = {};
    let newUsername;
    if (username) {
      const exist = await this.usersCol.firstExample({ username }).catch((e) => e);
      if (!(exist instanceof Error)) {
        if (exist._key !== user._key) {
          throw new Error('Username already in use with another account');
        }
      }
    }
    // const oldInfo = await this.usersCol.document(_id).catch((e) => e);
    // if (oldInfo instanceof Error) throw oldInfo;
    // eslint-disable-next-line prefer-const
    newUsername = username || user.username;
    if (!isAlphanumeric(newUsername) || !isLength(newUsername, 3)) {
      throw new Error('Username must be 3 characters or more and not contain special characters');
    }
    if (avator) userData.photoURL = avator;
    if (displayName) userData.displayName = displayName;
    if (email) userData.email = email;
    if (phoneNumber) userData.phoneNumber = phoneNumber;
    const fuser = await admin.auth().updateUser(user._key, userData).catch((e) => e);
    if (fuser instanceof Error) {
      const { message } = fuser;
      throw new Error(message || 'Failed to update firebase user');
    }
    userData.cover = cover || user.cover;
    const data = {
      username: newUsername,
      email: fuser.email,
      phoneNumber: fuser.phoneNumber,
      avator: fuser.photoURL,
      displayName: fuser.displayName,
      disabled: fuser.disabled,
      emailVerified: fuser.emailVerified,
      cover: userData.cover,
    };
    const auser = await this.usersCol.update(user._id, data)
      .then(() => this.usersCol.document(user._id)).catch((e) => e);
    if (auser instanceof Error) {
      throw auser;
    }
    return { user: auser, message: 'Profile updated successfully' };
  }

  getUserByExample(args) {
    return this.usersCol.firstExample(args).catch(() => { throw new Error('Not found'); });
  }

  getUsersByExample(args) {
    if (args) {
      return this.usersCol.byExample(args).then((arr) => arr.all())
        .catch(() => { throw new Error('Not found'); });
    }
    return this.getUsers();
  }

  getUserById(id) {
    return this.usersCol.document(id).catch((e) => {
      const { message } = e;
      throw new Error(message || 'Not found');
    });
  }

  getUsers() {
    return this.usersCol.all().then((arr) => arr.all().then((val) => {
      log(val);
      return val;
    })).catch((e) => e);
  }

  follow({ _id }, { to, type }) {
    if (!_id) throw Error('User is not logged in');
    const createdAt = (new Date()).toISOString();
    const q = aql`RETURN DOCUMENT(${to})`;
    if (type === 'DO') {
      return this.followsCol.save({ createdAt }, _id, to).then(async () => {
        const node = await this.db.query(q).then((arr) => arr.next()).catch((e) => e);
        if (node instanceof Error) {
          const { message } = node;
          throw new Error(message || 'Item was not found');
        }
        return { node, message: 'Followed successfully' };
      }).catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to follow');
      });
    }
    if (type === 'UNDO') {
      return this.followsCol.removeByExample({ _from: _id, _to: to })
        .then(async () => {
          const user = await this.db.query(q).then((arr) => arr.next()).catch((e) => e);
          if (user instanceof Error) {
            const { message } = user;
            throw new Error(message || 'Item was not found');
          }
          return { node: user, message: 'Unfollowed successfully' };
        }).catch((e) => {
          const { message } = e;
          throw new Error(message || 'Failed to unfollow ');
        });
    }
    throw new Error('Invalid Operation');
  }

  async like({ _id }, { to, type }) {
    if (!_id) throw Error('User is not logged in');
    const createdAt = (new Date()).toISOString();
    const q = aql`RETURN DOCUMENT(${to})`;

    if (type === 'DO') {
      const node = await this.likeCol.save({ createdAt }, _id, to)
        .then(() => this.db.query(q).then((arr) => arr.next()))
        .catch((e) => {
          const { message } = e;
          throw new Error(message || 'Failed to like item');
        });
      return { message: 'Liked item successfully', node };
    }
    if (type === 'UNDO') {
      return this.likeCol.removeByExample({ _from: _id, _to: to })
        .then(async () => {
          const node = await this.db.query(q).then((arr) => arr.next()).catch((e) => e);
          if (node instanceof Error) {
            const { message } = node;
            throw new Error(message || 'Item was not found');
          }
          return { node, message: 'Unliked item successfully' };
        });
    }
    throw new Error('Invalid Operation');
  }

  async fullTextSearch(user, { query, offset, limit }) {
    if (!user) throw new Error('User is not logged in');
    const q = aql`
    FOR post IN contentView
    SEARCH ANALYZER(
    post.description IN TOKENS(${query}, 'text_en') OR
    post.title IN TOKENS(${query}, 'text_en') OR
    post.summary IN TOKENS(${query}, 'text_en') OR
    post.username IN TOKENS(${query}, 'text_en') OR
    post.displayName IN TOKENS(${query}, 'text_en') OR
    post.email IN TOKENS(${query}, 'text_en') OR
    post.bio IN TOKENS(${query}, 'text_en') OR
    post.feedName IN TOKENS(${query}, 'text_en') OR
    post.mediaName IN TOKENS(${query}, 'text_en') OR
    post.link IN TOKENS(${query}, 'text_en')OR
    post.feedUrl IN TOKENS(${query}, 'text_en') OR
    post.url IN TOKENS(${query}, 'text_en')OR
    post.categoryName IN TOKENS(${query}, 'text_en') OR
    post.tagName IN TOKENS(${query}, 'text_en')OR
    post.countryCode IN TOKENS(${query}, 'text_en') OR
    post.isoCountryCode IN TOKENS(${query}, 'text_en')
    , 'text_en')
    SORT BM25(post) DESC
    LIMIT ${offset},${limit}
    LET publisher = (FOR publisher, e,p IN 1..1 INBOUND post Publish,Reported return publisher)[0]
    RETURN {content:post,publisher}`;
    return this.db.query(q).then((arr) => arr.all())
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Error occured while Searching');
      });
  }
}


/*
export const signInWithEmail = (email, password) => {
  // eslint-disable-next-line new-cap
  const request = new https({
    hostname: signInWithEmailHost,
  });
  const returnSecureToken = true;
  // eslint-disable-next-line new-cap
  const buffer = new Buffer.from(JSON.stringify({ email, password, returnSecureToken }));
  return request.asyncPost({ path: signInWithEmailPath, buffer })
    // eslint-disable-next-line no-unused-vars
    .then(([status, headers, body]) => {
      if (status === 200) {
        const credential = JSON.parse(body);
        log(credential);
        return credential;
      }
      throw Error(status);
    });
};

export const createSessionToken = (idToken, expiresIn = 60 * 60 * 5 * 1000) => admin.auth()
  .verifyIdToken(idToken, true)
  .then((decodedIdToken) => {
    // Only process if the user just signed in in the last 5 minutes.
    if (new Date().getTime() / 1000 - decodedIdToken.auth_time < 5 * 60) {
      // Create session cookie and return it.
      return admin.auth().createSessionCookie(idToken, { expiresIn });
    }
    throw Error('A user that was not recently signed in is trying to set a session');
  });
export const destroySessionToken = (sessionToken) => admin.auth()
  .verifySessionCookie(sessionToken)
  .then((decodedClaims) => admin.auth()
    .revokeRefreshTokens(decodedClaims.sub)).then(() => true);

export const createUserWithEmail = (email, password, username) => admin.auth().createUser({
  email,
  emailVerified: false,
  // phoneNumber: '+11234567890',
  password,
  displayName: username,
  // photoURL: 'http://www.example.com/12345678/photo.png',
  disabled: false,
});
export const createUserWithProvider = () => {};
*/
