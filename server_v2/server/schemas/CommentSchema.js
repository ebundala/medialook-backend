import { gql } from 'apollo-server-express';

export default gql`
input CommentEditInput {
    _id: ID!
    commentText: String
}
input CommentInput {
    subject: ID!
    commentText: String!
}

type CommentPayload {
    message: String!
    comment: Comment!
    subject: Content
}
type Comment {
    _id: ID!
    _key: String!
    _rev: String!
    _from: String!
    _to: String!
    commentText: String!
    createdAt: String
}
input CommentQuery{
    _id: ID!    
    offset: Int 
    limit: Int
}
type CommentResult{
    comment: Comment
    author: User
}
extend type Mutation {
    comment(input: CommentInput!): CommentPayload
    editComment(input:CommentEditInput!):CommentPayload
    deleteComment(input:DeleteInput):DeletePayload
}
extend type Query{
    getComments(input:CommentQuery!):[CommentResult]
}
`;
