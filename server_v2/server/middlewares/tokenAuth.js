import { log } from 'console';
import admin from '../models/admin';

export default async (req) => {
  if (req.headers) {
    const token = req.headers.authorization;
    if (token) {
    // eslint-disable-next-line no-unused-vars
      const [bearer, sessionCookie] = token.split(' ');
      const claims = await admin.auth().verifySessionCookie(sessionCookie).catch((e) => e);
      if (claims instanceof Error) {
        log(claims);
      }
      return claims;
    }
  }
  return null;
};
export const idTokenAuth = async (req) => {
  const token = req.headers.authorization;
  if (token) {
    // eslint-disable-next-line no-unused-vars
    const [bearer, idToken] = token.split(' ');
    const claims = await admin.auth().verifyIdToken(idToken).catch((e) => e);
    if (claims instanceof Error) {
      log(claims);
    }
    return claims;
  }
  return null;
};
export const isLinked = ({ linked, _key }) => {
  if (linked === true && _key) {
    return true;
  }
  return false;
};
