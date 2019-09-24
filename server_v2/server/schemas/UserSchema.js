import { gql } from 'apollo-server-express';

export default gql`
type User {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String
    updatedAt: String
    username: String!
    displayName: String
    avator: String
    email: String!
    emailVerified: String
    disabled: Boolean
}

input SignUpInput{
    username: String!
    password: String!
    email: String!
}
input SignInInput{
    email: String!
    password: String!
}

input LinkIdProviderInput {
    idToken: String!
    username: String!
}
type AuthPayload {
    user: User!
    sessionToken: String!
}

type Mutation {
    signup(input: SignUpInput!): User
    signin(input: SignInInput!): AuthPayload
    startSession(idToken: String!): String
    destroySession(sessionToken: String!): Boolean
    linkIdProvider(input: LinkIdProviderInput): User
   
}

type Query {
    getUsers:[User!]!
}
`;
