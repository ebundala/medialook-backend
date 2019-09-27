import { log } from 'console';
import admin from '../models/admin';
import DB from '../config/db';

export default async (req) => {
  if (req.headers) {
    const token = req.headers.authorization;
    if (token) {
    // eslint-disable-next-line no-unused-vars
      const [bearer, sessionCookie] = token.split(' ');
      const claims = await admin.auth().verifySessionCookie(sessionCookie)
        .then(({ uid }) => DB.collection('Users').document(uid))
        .catch((e) => e);
      if (claims instanceof Error) {
        log(claims.message);
        return {};
      }
      return claims;
    }
  }
  return {};
};
export const idTokenAuth = async (req) => {
  const token = req.headers.authorization;
  if (token) {
    // eslint-disable-next-line no-unused-vars
    const [bearer, idToken] = token.split(' ');
    const user = await admin.auth().verifyIdToken(idToken)
      .then(({ uid }) => DB.collection('Users').document(uid))
      .catch((e) => e);
    if (user instanceof Error) {
      log(user);
      return {};
    }
    return user;
  }
  return {};
};
export const isLinked = ({ linked, _key }) => {
  if (linked === true && _key) {
    return true;
  }
  return false;
};
