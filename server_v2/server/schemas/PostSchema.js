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
    title: String!
    image: Image
    enclosures: [Image]
    author: String!
    link: String!
    guid: String
}
`;
