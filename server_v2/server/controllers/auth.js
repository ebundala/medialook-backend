/* eslint-disable no-underscore-dangle */
import { log } from 'console';
import { isEmail, isLength, isAlphanumeric } from 'validator';
import admin, {
  createUserWithEmail, signInWithEmail, createSessionToken, destroySessionToken,
} from '../models/admin';
import { ApiSuccess, ApiError } from '../models/responses';
import DB from '../config/db';

const setUserClaims = (user) => admin.auth()
  .setCustomUserClaims(user._key, { linked: true, role: 1, _key: user._key })
  .then(() => true).catch(() => false);

export const loginHandler = (req, res) => {
  const { email, password, username } = req.body;
  log(req.body);
  res.status(200).json({ email, password, username });
};
// Link a user who signed up using id providers by recieving an idtoken
export const linkIDProvider = async (req, res) => {
  const idTokenHeader = req.headers.authorization;
  log(idTokenHeader, req.body);
  const { username } = req.body;
  log(username);
  if (!idTokenHeader) {
    res.status(401).json(new ApiError(true, 401, 'No id Token provided'));
  } else if (!username) {
    res.status(400).json(new ApiError(true, 400, 'Username is required'));
  } else {
    // eslint-disable-next-line no-unused-vars
    const [bearer, token] = idTokenHeader.split(' ');
    admin.auth().verifyIdToken(token, true)
      .then(async (info) => {
        const {
          linked, role, _key, uid,
        } = info;

        if (linked && role && _key === uid) {
          res.status(400).json(new ApiError(true, 400, 'Provided token is already linked to a user'));
        } else if (!isLength(username, 3)) {
          res.status(400).json(new ApiError(true, 400, 'Username must be 3 characters or more'));
        } else if (!isAlphanumeric(username)) {
          res.status(400).json(new ApiError(true, 400, 'Username can not contain special characters'));
        } else {
          const user = await admin.auth().getUser(uid).catch((error) => error);
          if (user instanceof Error) {
            res.status(400).json(new ApiError(user, 400, 'Failed to get user account'));
          } else {
            const {
              email, displayName, photoURL, phoneNumber, disabled, emailVerified,
            } = user;

            const users = DB.collection('users');
            const exist = await users.firstExample({ email }).catch(() => false);
            const exist2 = await users.firstExample({ username }).catch(() => false);
            if (exist) {
              // Todo handle case were user is in database and firebase but has no claims set
              res.status(400).json(new ApiError(true, 400, 'The email address is already in use by another account'));
            } else if (exist2) {
              res.status(400).json(new ApiError(true, 400, 'The Username is already in use by another account'));
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
                res.status(500).json(new ApiError(auser, 500, auser.message || 'Failed to create user account'));
              } else {
                // set claims here
                const setClaims = await setUserClaims(auser);
                if (setClaims) {
                  const data = await users.document(auser).catch((error) => error);
                  if (data instanceof Error) {
                    res.status(500).json(new ApiError(data, 500, data.message || 'Failed to get user info with session'));
                  } else {
                    res.status(200).json(new ApiSuccess(data, 200, 'User linked with provider successfully'));
                  }
                }
              }
            }
          }
        }
      });
  }
};

export const signUpHandler = async (req, res) => {
  const { email, password, username } = req.body;
  if (!isEmail(email)) {
    res.status(400).json(new ApiError(true, 400, 'Invalid Email'));
  } else if (!isLength(password, 6)) {
    res.status(400).json(new ApiError(true, 400, 'Password must be atleast 6 characters long'));
  } else if (!isLength(username, 3)) {
    res.status(400).json(new ApiError(true, 400, 'Username must be 3 characters or more'));
  } else if (!isAlphanumeric(username)) {
    res.status(400).json(new ApiError(true, 400, 'Username can not contain special characters'));
  } else {
    const users = DB.collection('users');
    const exist = await users.firstExample({ email }).catch(() => false);
    const exist2 = await users.firstExample({ username }).catch(() => false);
    if (exist) {
      res.status(400).json(new ApiError(true, 400, 'The email address is already in use by another account'));
    } else if (exist2) {
      res.status(400).json(new ApiError(true, 400, 'The Username is already in use by another account'));
    } else {
      createUserWithEmail(email, password, username)
        .then((user) => users.save({
          _key: user.uid,
          username: user.displayName,
          disabled: user.disabled,
          email: user.email,
          emailVerified: user.emailVerified,
          avator: user.photoURL,
          role: 1,
        })).then(async (user) => {
          const setClaims = await setUserClaims(user);
          if (setClaims) {
            const token = await signInWithEmail(email, password)
              .then(({ idToken }) => createSessionToken(idToken))
              .catch((e) => e);
            if (token instanceof Error) {
              throw token;
            }
            return users.document(user).then((u) => ({ ...u, token }));
          }
          const remove1 = await admin.auth()
            .deleteUser(user._key).then(() => true).catch(() => false);
          const remove2 = await users.remove(user)
            .then(() => true).catch(() => false);
          if (remove1 && remove2) {
            throw Error('Failed to create user account');
          } else throw Error('Failed to cleanup user signup errors');
        }).then((user) => {
          res.status(201).json(new ApiSuccess(user, 201, 'User created susscessfully'));
        })
        .catch((e) => {
          res.status(500).json(new ApiError(e, 500, e.message || 'Internal Server error'));
        });
    }
  }
};

export const createSession = async (req, res) => {
  const idToken = req.headers.authorization;
  if (idToken) {
    // eslint-disable-next-line no-unused-vars
    const [bearer, token] = idToken.split(' ');
    const sessionToken = await createSessionToken(token).catch((error) => error);
    if (sessionToken instanceof Error) {
      res.status(401).json(new ApiError(sessionToken, 401, 'Failed to create a session'));
    }
    res.status(201).json(new ApiSuccess(sessionToken, 201, 'Session created successfully'));
  } else {
    res.status(401).json(new ApiError(true, 401, 'No idToken provided'));
  }
};

export const revokeSession = async (req, res) => {
  const { sessionToken } = req;
  if (!sessionToken) {
    res.status(400).json(new ApiError(true, 400, 'Invalid session cannot be revoked'));
  } else {
    const isRevoked = await destroySessionToken(sessionToken).catch((error) => error);
    if (isRevoked === true) {
      res.status(200).json(new ApiSuccess(isRevoked, 200, 'Session revoked Successfully'));
    } else {
      res.status(400).json(new ApiError(isRevoked, 400, 'Failed to revoke session'));
    }
  }
};
