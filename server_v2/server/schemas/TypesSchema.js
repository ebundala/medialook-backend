import { gql } from 'apollo-server-express';

export default gql`
type Image {
     type: String
     url: String!
     width: Int
     height: Int
     length: Int
}

`;
