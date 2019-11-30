import { gql } from 'apollo-server-express';

export default gql`
type Tag {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String @timestamp
    updatedAt: String @timestamp
    tagName: String!
    importance: Int!
}
extend type Query{
    tags:[Tag]
}
`;
