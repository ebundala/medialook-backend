
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
  username,
  categories,
  countries,
  tags,
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
  getComments,
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
    categories,
    countries,
    tags,
    getComments,
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
  User: {
    isFollowed: ({ _id }, args, { dataloaders }) => dataloaders.isFollowed.load(_id),
    isLiked: ({ _id }, args, { dataloaders }) => dataloaders.isLiked.load(_id),
    isCommented: ({ _id }, args, { dataloaders }) => dataloaders.isCommented.load(_id),
    // isShared: ({ _id }, args, { dataloaders }) => false, // dataloaders.isShared.load(_id),
    // isViewed: ({ _id }, args, { dataloaders }) => dataloaders.isViewed.load(_id),
    likesCount: ({ _id }, args, { dataloaders }) => dataloaders.likesCount.load(_id),
    commentsCount: ({ _id }, args, { dataloaders }) => dataloaders.commentsCount.load(_id),
    followersCount: ({ _id }, args, { dataloaders }) => dataloaders.followersCount.load(_id),
    followingsCount: ({ _id }, args, { dataloaders }) => dataloaders.followingsCount.load(_id),
    reportsCount: ({ _id }, args, { dataloaders }) => dataloaders.reportsCount.load(_id),

  },
  Feed: {
    isFollowed: ({ _id }, args, { dataloaders }) => dataloaders.isFollowed.load(_id),
    isLiked: ({ _id }, args, { dataloaders }) => dataloaders.isLiked.load(_id),
    isCommented: ({ _id }, args, { dataloaders }) => dataloaders.isCommented.load(_id),
    // isShared: ({ _id }, args, { dataloaders }) => false, // dataloaders.isShared.load(_id),
    // isViewed: ({ _id }, args, { dataloaders }) => dataloaders.isViewed.load(_id),
    likesCount: ({ _id }, args, { dataloaders }) => dataloaders.likesCount.load(_id),
    commentsCount: ({ _id }, args, { dataloaders }) => dataloaders.commentsCount.load(_id),
    followersCount: ({ _id }, args, { dataloaders }) => dataloaders.followersCount.load(_id),
    followingsCount: ({ _id }, args, { dataloaders }) => dataloaders.followingsCount.load(_id),
    postsCount: ({ _id }, args, { dataloaders }) => dataloaders.postsCount.load(_id),

  },
  Post: {
    isLiked: ({ _id }, args, { dataloaders }) => dataloaders.isLiked.load(_id),
    isCommented: ({ _id }, args, { dataloaders }) => dataloaders.isCommented.load(_id),
    // isShared: ({ _id }, args, { dataloaders }) => false, // dataloaders.isShared.load(_id),
    // isViewed: ({ _id }, args, { dataloaders }) => dataloaders.isViewed.load(_id),
    likesCount: ({ _id }, args, { dataloaders }) => dataloaders.likesCount.load(_id),
    commentsCount: ({ _id }, args, { dataloaders }) => dataloaders.commentsCount.load(_id),

  },
  Report: {
    isLiked: ({ _id }, args, { dataloaders }) => dataloaders.isLiked.load(_id),
    isCommented: ({ _id }, args, { dataloaders }) => dataloaders.isCommented.load(_id),
    // isShared: ({ _id }, args, { dataloaders }) => false, // dataloaders.isShared.load(_id),
    // isViewed: ({ _id }, args, { dataloaders }) => dataloaders.isViewed.load(_id),
    likesCount: ({ _id }, args, { dataloaders }) => dataloaders.likesCount.load(_id),
    commentsCount: ({ _id }, args, { dataloaders }) => dataloaders.commentsCount.load(_id),

  },
};

export default resolvers;
