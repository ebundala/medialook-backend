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

export const updateProfile = (root, { input, avatorFile, coverFile },
  { dataSources, user }, info) => dataSources.users.updateProfile(user, input,
  avatorFile, coverFile);

export const getUser = (root, { input },
  { dataSources, user }, info) => dataSources.users.getUserByExample(user, input);

export const follow = (root, { input },
  { dataSources, user }, info) => dataSources.users.follow(user, input);

export const like = (root, { input },
  { dataSources, user }, info) => dataSources.users.like(user, input);

export const search = (root, { input },
  { user, dataSources }, info) => dataSources.users.fullTextSearch(user, input);

// eslint-disable-next-line no-shadow
export const username = (root, { username },
  { dataSources }, info) => dataSources.users.checkUsernameAvailability(username);

export const categories = (root, args,
  { dataSources, user }, info) => dataSources.users.categories(user);

export const countries = (root, args,
  { dataSources, user }, info) => dataSources.users.countries(user);

export const tags = (root, args,
  { dataSources, user }, info) => dataSources.users.tags(user);


export const followers = (root, { input },
  { dataSources, user }, info) => dataSources.users.followers(user, input);

export const followings = (root, { input },
  { dataSources, user }, info) => dataSources.users.followings(user, input);

export const usersRecommendations = (root, { input },
  { dataSources, user }, info) => dataSources.users.usersRecommendations(user, input);

export const feedsRecommendations = (root, { input },
  { dataSources, user }, info) => dataSources.users.feedsRecommendations(user, input);
