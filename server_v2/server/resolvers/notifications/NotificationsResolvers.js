/* eslint-disable no-unused-vars */

export const getNotifications = (root, { input },
  { dataSources, user }, info) => dataSources.notifications.getNotifications(user, input);

export const countNotifications = {};
