import { ApolloServer } from 'apollo-server-express';
import typeDefs from '../schemas/schema';
import resolvers from '../resolvers/resolvers';
import sessionTokenAuth from '../middlewares/tokenAuth';
import UsersDataSource from '../models/Users';
import FeedDataSource from '../models/Feeds';
import ReportDataSource from '../models/Reports';
import CommentsDatasource from '../models/Comments';

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
    reports: new ReportDataSource(),
    comments: new CommentsDatasource(),
  }),
});
