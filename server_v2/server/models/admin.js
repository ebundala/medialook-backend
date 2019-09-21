import * as admin from 'firebase-admin';
import { log } from 'console';
import { https } from 'request-easy';

import env from '../config/config';


import credentials from '../../serviceAccount.json';

// eslint-disable-next-line no-unused-vars
const signInWithProviderHost = 'identitytoolkit.googleapis.com';
// eslint-disable-next-line no-unused-vars
const signInWithProviderPath = `/v1/accounts:signInWithIdp?key=${env.FIREBASE_API_KEY}`;

const signInWithEmailHost = 'identitytoolkit.googleapis.com';
const signInWithEmailPath = `/v1/accounts:signInWithPassword?key=${env.FIREBASE_API_KEY}`;

admin.initializeApp(
  {
    credential: admin.credential.applicationDefault(),
    databaseURL: `https://${credentials.project_id}.firebaseio.com`,
  },
);


export default admin;

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
