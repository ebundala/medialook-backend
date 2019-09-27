import { gql } from 'apollo-server-express';

export default gql`
type CommentInput {
    subject: String!
    commentText: String!
}
type CommentPayload {
    message: String!
    comment: Comment!
}
type Comment {
    _id: ID!
    _key: String!
    _rev: String!
    commentText: String!
}
`;
