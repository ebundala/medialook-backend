import { gql } from 'apollo-server-express';

export default gql`

type Feed {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String
    updatedAt: String
    featuredImage: String
    feedName: String
    countryCode: String
    feedUrl: String!
    url: String!
    categoryName: String
    mediaName: String
}
input FeedInput {
    query: String!
    offset: Int!
    limit: Int!
}
type FeedPayload {
    message: String
    cursor: String
    feeds:[Feed]
}
extend type Mutation{
    addFeed(input: FeedInput!): FeedPayload
}
`;
