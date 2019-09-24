/* eslint-disable no-unused-vars */

// eslint-disable-next-line no-unused-vars
const usersResolver = (root, args, { dataSources }, info) => dataSources.users.getUsers(args);

export default usersResolver;

export const signin = (root, { input },
  { dataSources }, info) => dataSources.users.signInWithEmail(input);

export const signup = (root, { input },
  { dataSources }, info) => dataSources.users.signupWithEmail(input);

export const startSession = (root, { idToken },
  { dataSources }, info) => dataSources.users.createSessionToken(idToken);


export const destroySession = (root, { sessionToken },
  { dataSources }, info) => dataSources.users.destroySessionToken(sessionToken);

export const linkIdProvider = (root, { input },
  { dataSources }, info) => dataSources.linkIdProvider(input);

export const updateProfile = (root, { input },
  { dataSources, user }, info) => dataSources.users.updateProfile(user, input);
