import { gql } from 'apollo-server-express';

export default gql`

type Report {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String
    country: String
    altitude: Float
    latitude: Float
    longitude: Float
    locality: String
    subLocality: String
    isoCountryCode: String
    locationName: String
    enclosures: [Image]
    district: String
    region: String
    text: String!
    tagName: String
    author: User
    isLiked: Boolean
    isCommented: Boolean
    isShared: Boolean
    isViewed: Boolean
    likesCount: Int
    commentsCount: Int
    sharesCount: Int
    viewsCount: Int
}

input ImageInput{
    type: String
    url: String!
    width: Int 
    height: Int 
    length: Int
}

input ReportInput {
    country: String
    altitude: Float
    latitude: Float
    longitude: Float
    locality: String
    subLocality: String
    isoCountryCode: String
    locationName: String
    enclosures: [ImageInput]
    district: String
    region: String
    text: String!
    tagName: String!
}
 
 input ReportEditInput{
     _id: ID!
    country: String
    altitude: Float
    latitude: Float
    longitude: Float
    locality: String
    subLocality: String
    isoCountryCode: String
    locationName: String
    enclosures: [ImageInput!]
    district: String
    region: String
    text: String!
    tagName: String
}

input ReportQueryInput {
    id: ID
    userId: ID
    tagName: String
    followed: Boolean
    isoCountryCode: String
    offset: Int!
    limit: Int!
}

type ReportPayload {
    message: String!
    report: Report!
}
enum FileUploadType{
    COVER
    AVATOR
    ENCLOSURE
}
type File {
    filename: String!
    mimetype: String!
    encoding: String!
    record(type:FileUploadType):Content
  }

extend type Mutation {
    createReport(input: ReportInput!,file: Upload!): ReportPayload   
    editReport(input: ReportEditInput!): ReportPayload
    deleteReport(input: DeleteInput!): DeletePayload
    singleUpload(file:Upload!):File!
}

extend type Query{
    getReports(input: ReportQueryInput!): [Report]
}
`;
