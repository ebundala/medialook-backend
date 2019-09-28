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
    enclosures: [Image!]
    district: String
    region: String
    text: String!
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
    enclosures: [ImageInput!]
    district: String
    region: String
    text: String!
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
}

type ReportPayload {
    message: String!
    report: Report!
}


extend type Mutation {
    createReport(input: ReportInput!): ReportPayload   
    editReport(input: ReportEditInput!): ReportPayload
    deleteReport(input: DeleteInput!): DeletePayload
}
`;
