
export const getPosts = (root, { input },
  { user, dataSources }) => dataSources.posts.getPosts(user, input);

export const getPostsCount = {};
