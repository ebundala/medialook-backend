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
input FeedEditInput{
    _id: ID!
    categoryName: String
    countryCode: String
    feedUrl: String
    feedName: String
    mediaName: String
    url: String
    featuredImage: String
}
input FeedDeleteInput {
    _id: ID!
}
type FeedDeletePayload{
    message: String!
    _id: ID!
}
type FeedEditPayload{
    message: String!
    feed: Feed!
}
type FeedPayload {
    message: String
    cursor: String
    feeds:[Feed]
}
extend type Mutation{
    addFeed(input: FeedInput!): FeedPayload
    editFeed(input: FeedEditInput!): FeedEditPayload
    deleteFeed(input: FeedDeleteInput!): FeedDeletePayload
}
`;
