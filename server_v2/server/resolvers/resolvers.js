
import users, {
  signin,
  signup,
  destroySession,
  startSession,
  linkIdProvider,
  updateProfile,
  getUser,
  followUser,
} from './users/UsersResolvers';
import addFeed,
{
  followFeed,
  deleteFeed,
  editFeed,
} from './feeds/FeedsResolvers';

const parseType = (id) => {
  const [type] = id.split('/');
  switch (type) {
    case 'Feeds':
      return 'Feed';
    case 'Users':
    default:
      return 'User';
  }
};

const resolvers = {
  Query: {
    getUsers: users,
    user: getUser,
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
    follow: (parent, args, context, info) => {
      const { input } = args;
      const { to } = input;
      const type = parseType(to);
      if (type === 'Feed') {
        return followFeed(parent, args, context, info);
      }
      return followUser(parent, args, context, info);
    },
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
