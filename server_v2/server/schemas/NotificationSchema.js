import { gql } from 'apollo-server-express';

export default gql`
type NotificationAction {
    _id: ID!
    _from: String!
    _to: String!
    createdAt: String @timestamp
    commentText: String
}
type Notification{
    action: NotificationAction!
    actor: User!
    subject: Content!
}
input NotificationInput{
    offset: Int!
    limit: Int!
}
extend type Query {
    getNotifications(input: NotificationInput):[Notification]
}
`;
