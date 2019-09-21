import admin from '../models/admin';
import { ApiError } from '../models/responses';

const tokenAuth = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    // eslint-disable-next-line no-unused-vars
    const [bearer, sessionCookie] = token.split(' ');
    admin.auth().verifySessionCookie(sessionCookie)
      .then((decodedClaims) => {
        // eslint-disable-next-line no-underscore-dangle
        if (decodedClaims.linked === true && decodedClaims._key) {
          req.claims = decodedClaims;
          req.sessionToken = token;
          next();
        } else {
          throw Error('Account not linked, Please complete signup');
        }
      })
      .catch((error) => {
        // Session cookie is unavailable or invalid. Force user to login.
        res.status(401).json(new ApiError(error, 401, error.message || 'UNAUTHORIZED REQUEST'));
      });
  } else {
    res.status(401).json(new ApiError(true, 401, 'UNAUTHORIZED REQUEST'));
  }
};
export default tokenAuth;
