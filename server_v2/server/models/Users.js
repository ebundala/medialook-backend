/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import { log } from 'console';
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
    this.collection = DB.collection('Users');
  }

  /* get collection() {
    return this.db.collection('users');
  }
  set collection(coll){
   this.col =
  } */
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
      const users = this.collection;
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
              return this.collection.document(decodedIdToken.uid)
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

  async updateProfile({ uid }, {
    username, avator, displayName, email, phoneNumber,
  }) {
    const userData = {};
    if (!uid) throw Error('User is not logged in');
    if (avator) userData.photoURL = avator;
    if (displayName) userData.displayName = displayName;
    if (email) userData.email = email;
    if (phoneNumber) userData.phoneNumber = phoneNumber;
    const user = await admin.auth().updateUser(uid, userData).catch((e) => e);
    if (user instanceof Error) {
      throw user;
    }
    if (username) userData.username = username;
    const data = {
      username: userData.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      avator: user.photoURL,
      displayName: user.displayName,
      disable: user.disabled,
      emailVerified: user.emailVerified,
    };
    const auser = await this.collection.update(user.uid, data)
      .then(() => this.collection.document(user.uid)).catch((e) => e);
    if (auser instanceof Error) {
      throw auser;
    }
    return { user: auser, message: 'Profile updated successfully' };
  }

  getUserByExample(args) {
    return this.collection.firstExample(args);
  }

  getUsersByExample(args) {
    return this.collection.byExample(args).then((arr) => arr.all());
  }

  getUserById(id) {
    return this.collection.document(id);
  }

  getUsers() {
    return this.collection.all().then((arr) => arr.all().then((val) => {
      log(val);
      return val;
    }));
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
