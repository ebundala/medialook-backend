import { gql } from 'apollo-server-express';

export default gql`

type Post {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String
    updatedAt: String
    pubDate: String!
    summary: String
    description: String
    title: String!
    image: Image
    enclosures: [Image]
    author: String!
    link: String!
    guid: String
    feed: Feed
}
input PostQueryInput {
    id: ID
    categoryName: String
    countryCode: String
    followed: Boolean
    feedId: ID
    offset: Int!
    limit: Int!
}
extend type Query {
    getPosts(input: PostQueryInput!): [Post]
}
`;
