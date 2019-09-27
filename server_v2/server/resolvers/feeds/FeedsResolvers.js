/* eslint-disable no-unused-vars */

const feedResolver = (root, { input },
  { dataSources, user }, info) => dataSources.feeds.addFeed(user, input);

export default feedResolver;

export const followFeed = (root, { input },
  { dataSources, user }, info) => dataSources.feeds.followFeed(user, input);
