import { gql } from 'apollo-server-express';

export default gql`
enum UserRoles{
    ADMIN
    SUBSCRIBER
    MODERATOR
}
enum FeedStatus{
    DORMANT
    ACTIVE
}
enum ContentStatus{
    SEEN
    UNSEEN
}

interface Node{
    id: ID!
    createdAt: String!
    updatedAt: String
}

type User implements Node {
    id: ID!
    createdAt: String!
    updatedAt: String
    username: String
    displayName: String
    email: String
    emailVerified: String
    disabled: Boolean

}
type Category implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    categoryName: String
    importance: Int
    posts:[Post]
}
type Country implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    countryName: String
    order: Int
}
type Tag implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    tagName: String
    importance: Int
    reports:[Report]
}
type Feed implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    feedName: String
    mediaName: String
    feedUrl: String
    featuredImage: String
    mediaUrl: String
    posts:[Post]
    followedBy: [User]
    postsCount: Int
    followsCount: Int
    isFollowed: Boolean
    categoryName: String
    countryCode: String

}
type Post implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    author: String
    description: String
    guid: String
    image: Image
    link: String!
    pubDate: String
    summary: String
    title: String!
    enclosures: [Enclosure]
    comments:[Comment]
    likesCount: Int
    commentsCount: Int
    isLiked: Boolean
    isCommented: Boolean
    isFollowed: Boolean
    commentedBy: [User]
    likedBy: [User]
}
type Enclosure{
    type: String!
    height: Int
    width: Int
    lenght: Int
    url: String!
}
type Image {
    type: String
    height: Int
    width: Int
    lenght: Int
    url: String!
}
type Report implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    caption: String
    country: String
    altitude: Float
    locationName: String
    subLocality: String
    isoCountryCode: String
    latitude: Float
    longitude: Float
    postalCode: String
    locality: Float
    district: Float
    region: Float
    reporter: User!
    isLiked: Boolean
    likedBy:[User]
    isFollowed: Boolean
    comments: [Comment]
    commentedBy:[User]
    commentCount: Int
    likesCount: Int
    encosures:[Enclosure]


}
type Comment implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    commentText: String!
    commenter: User
    subject: Content
}
type Abuse implements Node {
    id: ID!
    createdAt: String!
    updatedAt: String
    reporter: User
    subject: String
    abuseReport: String
    reported: Content

}
type Notification implements Node{
    id: ID!
    createdAt: String!
    updatedAt: String
    actionType: ActionType
    actor: User
    content: Content
}
enum ActionType{
    LIKED
    FOLLOWED
    COMMENTED
}
union Content = Comment | Post | Feed | Report | User

type Query {
      getUsers(userId: ID): [User]
}
`;
