/* eslint-disable class-methods-use-this */
import { GraphQLError } from 'graphql';
import { aql } from 'arangojs';
import DB from '../config/db';
import ArangoDatasource from './arangoDatasource/arangoDatasource';

export default class Comments extends ArangoDatasource {
  constructor() {
    super(DB);
    this.commentCol = DB.collection('Comments');
    this.commentOf = DB.edgeCollection('CommentOf');
    this.commented = DB.edgeCollection('Commented');
  }

  async comment({ _id }, { subject, commentText }) {
    if (!_id) throw GraphQLError('User is not loged in');
    const createdAt = (new Date()).toISOString();
    return this.commentCol
      .save({ createdAt, commentText })
      .then((com) => this.commented
        .save({ createdAt }, _id, com).then(() => com))
      .then((com) => this.commentOf.save({ createdAt }, com, subject).then(() => com))
      .then((com) => this.commentCol.document(com))
      .then((comment) => {
        const query = aql`RETURN Document(${subject})`;
        return DB.query(query).then((arr) => arr.next())
          .then((sb) => ({ message: 'Commented Succsessfully', subject: sb, comment }));
      })
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to comment ');
      });
  }

  async editComment(user, { _id, commentText }) {
    if (!user) throw new GraphQLError('User is not loged in');
    const updatedAt = (new Date()).toISOString();
    return this.commentCol.update(_id, { updatedAt, commentText })
      .then((com) => this.commentCol.document(com))
      .then((comment) =>
        // Todo query for subject content here
        // eslint-disable-next-line implicit-arrow-linebreak
        ({ message: 'Comment edited succssessfuy', subject: null, comment }))
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to update the comment');
      });
  }

  async deleteComment(user, { _id }) {
    if (!user) throw new GraphQLError('User is not loged in');
    return this.commentCol.remove(_id)
      .then(() => ({ message: 'Comment deleted succsessfully', _id }))
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to delete a comment');
      });
  }
}
