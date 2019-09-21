import users from './users/usersResolvers';

const resolvers = {
  Query: {
    getUsers: () => users(),
  },
};

export default resolvers;
