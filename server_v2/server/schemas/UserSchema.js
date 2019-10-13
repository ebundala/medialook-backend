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
    phoneNumber: String
    cover: String
    avator: String
    email: String!
    emailVerified: String
    disabled: Boolean
    isAdmin: Boolean
    isFollowed: Boolean
    isLiked: Boolean
    isCommented: Boolean
    isShared: Boolean
    isViewed: Boolean
    likesCount: Int
    commentsCount: Int
    followersCount: Int
    followingsCount: Int
    reportsCount: Int
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
input ProfileUpdateInput{
    displayName: String
    username: String
    email: String
    avator: String
    cover: String
    phoneNumber: String!
}
enum ActionType{
    DO
    UNDO
}
input ActionInput{
      to: String!
      type: ActionType!
}
type ProfilePayload{
    message: String!
    user: User!
}
type AuthPayload {
    message: String!
    user: User!
    sessionToken: String!
}
type LogoutPayload{
    message: String!
    status: Boolean!
}
type ActionPayload {
    message: String
    node: Content 
    }
type Mutation {
    signup(input: SignUpInput!): AuthPayload!
    signin(input: SignInInput!): AuthPayload!
    startSession(idToken: String!): AuthPayload!
    destroySession(sessionToken: String!): LogoutPayload!
    linkIdProvider(input: LinkIdProviderInput!): ProfilePayload!
    updateProfile(input: ProfileUpdateInput!): ProfilePayload!
    follow(input: ActionInput!): ActionPayload!
    like(input:ActionInput!): ActionPayload!
       
}
input UserQueryInput{
    _id: String
    _key: String
    username: String
    email: String
    phoneNumber: String
    disabled: Boolean
    emailVerified: Boolean
    displayName: String
    #todo impliment the logic for followes
    followed: Boolean
    followers: Boolean   
}
type UsernameAvailability{
    available: Boolean!
}
type Query {
    getUsers(input: UserQueryInput):[User!]!
    user(input:UserQueryInput): User!
    username(username:String!):UsernameAvailability!
}
`;
