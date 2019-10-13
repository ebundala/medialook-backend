/* eslint-disable no-unused-vars */

export const comment = (root, { input },
  { dataSources, user }, info) => dataSources.comments.comment(user, input);

export const editComment = (root, { input },
  { dataSources, user }, info) => dataSources.comments.editComment(user, input);

export const deleteComment = (root, { input },
  { dataSources, user }, info) => dataSources.comments.deleteComment(user, input);

export const getComments = (root, { input },
  { dataSources, user }, info) => dataSources.comments.getComments(user, input);
