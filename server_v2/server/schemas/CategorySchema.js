import { gql } from 'apollo-server-express';

export default gql`
type Category {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String
    updatedAt: String
    categoryName: String!
    importance: Int!
}
`;
