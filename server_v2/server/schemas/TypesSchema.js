import { gql } from 'apollo-server-express';

export default gql`
type Image {
     type: String
     url: String!
     width: Int
     height: Int
     length: Int
}
input DeleteInput{
    _id: ID!
}
type DeletePayload{
    message: String!
    _id: ID!
}
# union Subject = Report | Post  
union Content = User | Feed | Post | Report | Comment

type SearchResult{
    content: Content!
    publisher: Content
}
input SearchInput {
    query: String!
    offset: Int!
    limit: Int!
}
extend type Query {
    search(input: SearchInput!): [SearchResult]
}
`;
