/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import { log } from 'console';
import { aql } from 'arangojs';
import { isEmail, isLength, isAlphanumeric } from 'validator';
import { https } from 'request-easy';
import admin, { uploadFile } from './admin';
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
            role: 'SUBSCRIBER',
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
            const { message } = session;
            throw new Error(message || 'Signin failed something went wrong');
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
      .setCustomUserClaims(user._key, { role: 'SUBSCRIBER' })
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
      return admin.auth().verifyIdToken(idToken, true)
        .then(async (info) => {
          const {
            role, uid,
          } = info;

          if (role) {
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
                  role: 'SUBSCRIBER',
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

  async updateProfile(user, profile, avatorFile, coverFile) {
    this.isLogedIn(user._id);
    const userData = {};


    if (avatorFile) {
      const {
        createReadStream, filename, mimetype,
      } = await avatorFile;
      const stream = createReadStream();
      const fileUrl = await uploadFile(user._id, `profile/${user._id}/avator/${filename}`, mimetype, stream)
        .catch((e) => {
          const { message } = e;
          throw new Error(message || 'Failed to upload file');
        });
      if (!fileUrl) throw new Error('Failed to upload file');
      log(fileUrl);
      userData.photoURL = fileUrl;
    }
    // todo handle cover file
    if (coverFile) {
      const {
        createReadStream, filename, mimetype,
      } = await coverFile;
      const stream2 = createReadStream();
      const fileUrl2 = await uploadFile(user._id, `profile/${user._id}/cover/${filename}`, mimetype, stream2)
        .catch((e) => {
          const { message } = e;
          throw new Error(message || 'Failed to upload file');
        });
      if (!fileUrl2) throw new Error('Failed to upload file');
      userData.cover = fileUrl2;
    }
    let newUsername;
    if (profile) {
      const {
        username, avator, displayName, email, phoneNumber, cover, bio,
      } = profile;
      if (username) {
        const exist = await this.usersCol.firstExample({ username }).catch((e) => e);
        if (!(exist instanceof Error)) {
          if (exist._key !== user._key) {
            throw new Error('Username already in use with another account');
          }
        }
        newUsername = username;
        if (!isAlphanumeric(newUsername) || !isLength(newUsername, 3)) {
          throw new Error('Username must be 3 characters or more and not contain special characters');
        }
      }
      // const oldInfo = await this.usersCol.document(_id).catch((e) => e);
      // if (oldInfo instanceof Error) throw oldInfo;
      // eslint-disable-next-line prefer-const

      if (bio) userData.bio = bio;
      if (avator) userData.photoURL = avator;
      if (displayName && isLength(displayName, 2)) userData.displayName = displayName;
      if (email) userData.email = email;
      if (phoneNumber) userData.phoneNumber = phoneNumber;
      userData.cover = cover || userData.cover || user.cover;
    }
    const fuser = await admin.auth().updateUser(user._key, userData).catch((e) => e);
    if (fuser instanceof Error) {
      const { message } = fuser;
      throw new Error(message || 'Failed to update firebase user');
    }
    newUsername = newUsername || user.username;
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
    if (userData.bio) data.bio = userData.bio;
    const auser = await this.usersCol.update(user._id, data)
      .then(() => this.usersCol.document(user._id)).catch((e) => e);
    if (auser instanceof Error) {
      throw auser;
    }
    return { user: auser, message: 'Profile updated successfully' };
  }

  getUserByExample(user, args) {
    this.isLogedIn(user._id);
    let example = args;
    if (args.me) {
      example = { _id: user._id };
    }

    return this.usersCol.firstExample(example).then((res) => {
      log(res);
      return res;
    }).catch(() => { throw new Error('Not found'); });
  }

  getUsersByExample(user, args) {
    this.isLogedIn(user._id);
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
    this.isLogedIn(_id);
    if (_id === to) throw Error('Can not follow yourself');
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

  async checkUsernameAvailability(username) {
    // log(username);
    let available = false;
    if (!isAlphanumeric(username) || !isLength(username, 3)) {
      return { available };
    }
    available = await this.usersCol.firstExample({ username })
      .then((user) => {
        if (user && user._key) {
          return false;
        }
        return true;
      }).catch((e) => {
        const { message } = e;
        if (message === 'no match') {
          log('no_match');
          return true;
        }
        return false;
      });

    return { available };
  }

  async like({ _id }, { to, type }) {
    this.isLogedIn(_id);
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

  async fullTextSearch({ _id }, { query, offset, limit }, type) {
    this.isLogedIn(_id);
    const q = [];
    q.push(aql`
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
    post.isoCountryCode IN TOKENS(${query}, 'text_en') OR
    post.region IN TOKENS(${query}, 'text_en') OR
    post.district IN TOKENS(${query}, 'text_en') OR
    post.locality IN TOKENS(${query}, 'text_en') OR
    post.subLocality IN TOKENS(${query}, 'text_en') OR
    post.country IN TOKENS(${query}, 'text_en') OR
    post.locationName IN TOKENS(${query}, 'text_en') OR
    post.text IN TOKENS(${query}, 'text_en')
    , 'text_en')`);
    if (type) {
      log(type);
      q.push(aql`FILTER PARSE_IDENTIFIER(post).collection == ${type}`);
    }
    q.push(aql`SORT BM25(post) DESC
    LIMIT ${offset},${limit}
    RETURN post`);
    log(offset, limit, 'params');
    /* LET publisher = (FOR publisher, e,p IN 1..1 INBOUND post
      Publish,Reported return publisher)[0] */
    const qy = aql.join(q);
    return this.db.query(qy).then((arr) => arr.all())
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Error occured while Searching');
      });
  }

  categories(user) {
    this.isLogedIn(user._id);
    const query = aql`
  FOR category IN Categories
  SORT category.importance DESC
  RETURN category
  `;
    return this.db.query(query).then((arr) => arr.all().then((val) => val)).catch((e) => {
      const { message } = e;
      throw new Error(message || 'Failed to get categories');
    });
  }

  countries(user) {
    this.isLogedIn(user._id);
    const query = aql`
  FOR val IN Countries
  SORT val.admin ASC
  RETURN val
  `;
    return this.db.query(query).then((arr) => arr.all().then((val) => val)).catch((e) => {
      const { message } = e;
      throw new Error(message || 'Failed to get Countries');
    });
  }

  tags(user) {
    this.isLogedIn(user._id);
    const query = aql`
  FOR val IN Tags
  SORT val.importance DESC
  RETURN val
  `;
    return this.db.query(query).then((arr) => arr.all())
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to get tags');
      });
  }

  followers({ _id }, { offset, limit }) {
    this.isLogedIn(_id);
    const query = aql`
    FOR user IN 1..1 INBOUND ${_id} Follows
    SORT user.username
    LIMIT ${offset},${limit}
    RETURN user
    `;
    return this.db.query(query).then((arr) => arr.all())
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to get followers');
      });
  }

  followings({ _id }, { offset, limit }) {
    this.isLogedIn(_id);
    const query = aql`
    FOR user IN 1..1 OUTBOUND ${_id} Follows
    SORT user.username
    LIMIT ${offset},${limit}
    RETURN user
    `;
    return this.db.query(query).then((arr) => arr.all())
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to get followings');
      });
  }

  usersRecommendations({ _id }, { offset, limit }) {
    this.isLogedIn(_id);
    // TODO just load users not followed for now later use interest based
    const query = aql`
    let followed = UNION((
      FOR friend IN 1..1 OUTBOUND ${_id} Follows
      FILTER HAS(friend,"username")
      RETURN friend
    ),[DOCUMENT(${_id})])
    FOR user IN Users 
    FILTER user NOT IN followed
    SORT user._key
    LIMIT ${offset},${limit}
    RETURN user
    `;
    return this.db.query(query).then((arr) => arr.all()).then((res) => this.shuffleArray(res))
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to get users recommendations');
      });
  }

  feedsRecommendations({ _id }, { offset, limit }) {
    this.isLogedIn(_id);
    const query = aql`
    let followed = (
      FOR friend IN 1..1 OUTBOUND ${_id} Follows
      FILTER HAS(friend,"feedUrl")
      RETURN friend
    )
    FOR feed IN Feeds 
    FILTER feed NOT IN followed
    SORT feed._key
    LIMIT ${offset},${limit}
    RETURN feed
    `;
    return this.db.query(query).then((arr) => arr.all()).then((res) => this.shuffleArray(res))
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to get feeds recommendations');
      });
  }

  role(user, { email, role }) {
    if (!user._id && (user.role !== 'ADMIN' || user.role !== 'DEVELOPER')) {
      throw new Error('You dont have permission to perform this task');
    }
    if (!email || !isEmail(email)) throw new Error('Invalid user email');
    if (!role || (role !== 'SUBSCRIBER' && role !== 'EDITOR'
    && role !== 'MODERATOR' && role !== 'ADMIN'
    && role !== 'DEVELOPER')) throw new Error('Invalid role');

    return admin.auth().getUserByEmail(email)
      .then((auser) => {
        const { uid } = auser;
        return admin.auth().setCustomUserClaims(uid, { role })
          .then(() => this.usersCol.update({ _key: uid }, { role },
            { returnNew: true, mergeObjects: true }))
          .then((res) => ({ message: 'User role changed successfully', user: res.new }))
          .catch((e) => {
            const { message } = e;
            throw new Error(message || 'Unknown error occured');
          });
      });
  }

  shuffleArray(array) {
    // eslint-disable-next-line no-plusplus
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // eslint-disable-next-line no-param-reassign
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
