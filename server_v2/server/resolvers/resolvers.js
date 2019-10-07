
import {
  signin,
  signup,
  destroySession,
  startSession,
  linkIdProvider,
  updateProfile,
  getUser as user,
  getUsers,
  follow,
  like,
  search,
  username
} from './users/UsersResolvers';
import
{
  addFeed,
  deleteFeed,
  editFeed,
} from './feeds/FeedsResolvers';
import {
  createReport,
  editReport,
  deleteReport,
  getReports,
} from './reports/ReportResolvers';

import {
  comment,
  editComment,
  deleteComment,
} from './comments/CommentsResolvers';
import { getPosts } from './posts/PostsResolvers';
import { getNotifications } from './notifications/NotificationsResolvers';

const parseType = (id) => {
  const [type] = id.split('/');
  switch (type) {
    case 'Feeds':
      return 'Feed';
    case 'Users':
      return 'User';
    case 'Posts':
      return 'Post';
    case 'Reports':
      return 'Report';
    case 'Comments':
      return 'Comment';
    case 'Reviews':
      return 'Review';
    default:
      return null;
  }
};

const resolvers = {
  Query: {
    getUsers,
    user,
    getPosts,
    getReports,
    getNotifications,
    search,
    username,
  },
  Mutation: {
    signup,
    signin,
    startSession,
    destroySession,
    linkIdProvider,
    updateProfile,
    addFeed,
    deleteFeed,
    editFeed,
    createReport,
    editReport,
    deleteReport,
    comment,
    deleteComment,
    editComment,
    follow,
    like,
  },
  Content: {
    // eslint-disable-next-line no-underscore-dangle
    __resolveType(parent) { return parseType(parent._id); },
  },
  /* AuthPayload: {
    sessionToken: (parent, args, context) => {
      log(context.user);
      return 'token here';
    },
  }, */
};

export default resolvers;
