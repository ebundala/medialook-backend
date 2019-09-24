import users, {
  signin,
  signup,
  destroySession,
  startSession,
  linkIdProvider,
  updateProfile,
} from './users/UsersResolvers';

const resolvers = {
  Query: {
    getUsers: users,
  },
  Mutation: {
    signup,
    signin,
    startSession,
    destroySession,
    linkIdProvider,
    updateProfile,
  },
  /* AuthPayload: {
    sessionToken: (parent, args, context) => {
      log(context.user);
      return 'token here';
    },
  }, */
};

export default resolvers;
