/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import { GraphQLError } from 'graphql';
import { aql } from 'arangojs';
import DB from '../config/db';
import ArangoDatasource from './arangoDatasource/arangoDatasource';

export default class Comments extends ArangoDatasource {
  constructor() {
    super(DB);
    this.commentCol = DB.edgeCollection('Comment');
  }

  async comment({ _id }, { subject, commentText }) {
    if (!_id) throw GraphQLError('User is not loged in');
    const createdAt = (new Date()).toISOString();
    const returnNew = true;
    return this.commentCol.save({ createdAt, commentText }, _id, subject, { returnNew })
      .then(async (com) => {
        const query = aql`RETURN Document(${com.new._to})`;
        const sb = this.db.query(query).then((arr) => arr.next()).catch(() => null);
        // console.log({ message: 'Commented Succsessfully', subject: sb, comment: com });
        return { message: 'Commented Succsessfully', subject: sb, comment: com.new };
      })
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to comment ');
      });
  }

  async editComment(user, { _id, commentText }) {
    if (!user) throw new GraphQLError('User is not loged in');
    const updatedAt = (new Date()).toISOString();
    const returnNew = true;
    return this.commentCol.update(_id, { updatedAt, commentText }, { returnNew })
      .then((comment) => {
        const query = aql`RETURN Document(${comment.new._to})`;
        const sb = this.db.query(query).then((arr) => arr.next()).catch(() => null);

        return {
          message: 'Comment edited succssessfuy',
          subject: sb,
          comment: comment.new,
        };
      })
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to update the comment');
      });
  }

  async deleteComment(user, { _id }) {
    if (!user) throw new GraphQLError('User is not loged in');
    return this.commentCol.remove(_id, { returnOld: true })
      .then(() => ({ message: 'Comment deleted succsessfully', _id }))
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to delete a comment');
      });
  }
}
