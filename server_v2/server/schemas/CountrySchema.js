import { gql } from 'apollo-server-express';

export default gql`
type Country {
    _id: ID!
    _key: String!
    _rev: String!
    createdAt: String
    updatedAt: String
    countryName: String!
    admin: String
    iso2: String
    iso3: String
    continent: String
    geometry: String
    abbrev: String
    flag: String
}

extend type Query{
    countries:[Country]
}
`;
