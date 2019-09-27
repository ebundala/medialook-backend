import { ApolloServer } from 'apollo-server-express';
import typeDefs from '../schemas/schema';
import resolvers from '../resolvers/resolvers';
import sessionTokenAuth from '../middlewares/tokenAuth';
import UsersDataSource from '../models/Users';
import FeedDataSource from '../models/Feeds';

export default new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const user = await sessionTokenAuth(req);
    return {
      user,
    };
  },
  dataSources: () => ({
    users: new UsersDataSource(),
    feeds: new FeedDataSource(),
  }),
});
