/* eslint-disable no-param-reassign */
/* eslint-disable class-methods-use-this */
import { SchemaDirectiveVisitor } from 'apollo-server';
import { defaultFieldResolver, GraphQLInt } from 'graphql';

// Create (or import) a custom schema directive
export default class TimestampDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field;
    field.resolve = async (...args) => {
      const result = await resolve.apply(this, args);
      if (typeof result === 'string') {
        return Math.floor((new Date(result)).getTime() / 1000);
      }
      return result;
    };
    field.type = GraphQLInt;
  }
}
