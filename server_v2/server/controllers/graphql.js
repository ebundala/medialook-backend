import { ApolloServer } from 'apollo-server-express';
import typeDefs from '../schemas/schema';
import resolvers from '../resolvers/resolvers';
import DB from '../config/db';

export default new ApolloServer({
  typeDefs,
  resolvers,
  context: (args) => ({ DB, args }),
});
