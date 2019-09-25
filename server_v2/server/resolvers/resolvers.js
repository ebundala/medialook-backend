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
    followUser,
  },
  /* AuthPayload: {
    sessionToken: (parent, args, context) => {
      log(context.user);
      return 'token here';
    },
  }, */
};

export default resolvers;
