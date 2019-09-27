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
type ReportInput {
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
type ReportPayload {
    message: String!
    report: Report!
}
`;
