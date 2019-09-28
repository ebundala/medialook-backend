/* eslint-disable no-unused-vars */

export const addFeed = (root, { input },
  { dataSources, user }, info) => dataSources.feeds.addFeed(user, input);

export const followFeed = (root, { input },
  { dataSources, user }, info) => dataSources.feeds.followFeed(user, input);

export const deleteFeed = (root, { input },
  { dataSources, user }, info) => dataSources.feeds.deleteFeed(user, input);

export const editFeed = (root, { input },
  { dataSources, user }, info) => dataSources.feeds.editFeed(user, input);
