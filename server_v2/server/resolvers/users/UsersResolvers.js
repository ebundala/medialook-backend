/* eslint-disable no-unused-vars */

// eslint-disable-next-line no-unused-vars
export const getUsers = (root, { input },
  { dataSources }, info) => dataSources.users.getUsersByExample(input);


export const signin = (root, { input },
  { dataSources }, info) => dataSources.users.signInWithEmail(input);

export const signup = (root, { input },
  { dataSources }, info) => dataSources.users.signupWithEmail(input);

export const startSession = (root, { idToken },
  { dataSources }, info) => dataSources.users.createSessionToken(idToken);


export const destroySession = (root, { sessionToken },
  { dataSources }, info) => dataSources.users.destroySessionToken(sessionToken);

export const linkIdProvider = (root, { input },
  { dataSources }, info) => dataSources.users.linkIdProvider(input);

export const updateProfile = (root, { input },
  { dataSources, user }, info) => dataSources.users.updateProfile(user, input);

export const getUser = (root, { input },
  { dataSources }, info) => dataSources.users.getUserByExample(input);

export const follow = (root, { input },
  { dataSources, user }, info) => dataSources.users.follow(user, input);

export const like = (root, { input },
  { dataSources, user }, info) => dataSources.users.like(user, input);

export const search = (root, { input },
  { user, dataSources }, info) => dataSources.users.fullTextSearch(user, input);
  
export const username = (root, { username } ,
  { dataSources }, info) => dataSources.users.checkUsernameAvailability(username);