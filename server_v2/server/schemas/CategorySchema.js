import { gql } from 'apollo-server-express';

export default gql`
type Category {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String @timestamp
    updatedAt: String @timestamp
    categoryName: String!
    importance: Int!
}
extend type Query{
    categories:[Category]
}
`;
