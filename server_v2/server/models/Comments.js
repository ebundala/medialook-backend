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
    this.isLogedIn(_id);
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
    this.isLogedIn(user._id);
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
    this.isLogedIn(user._id);
    return this.commentCol.remove(_id, { returnOld: true })
      .then(() => ({ message: 'Comment deleted succsessfully', _id }))
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to delete a comment');
      });
  }

  getComments(user, { _id, offset, limit }) {
    this.isLogedIn(user._id);
    if (!_id || offset === undefined || limit === undefined) throw new GraphQLError('Invalid query missing required data');

    const query = aql`
    FOR author,e IN 1..1 INBOUND ${_id} Comment
    SORT e.createdAt DESC
    LIMIT ${offset},${limit}
    RETURN {comment:e,author}
    `;
    return this.db.query(query)
      .then((arr) => arr.all())
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to get comments');
      });
  }
}
