import { aql } from 'arangojs';
import DB from '../config/db';
import ArangoDatasource from './arangoDatasource/arangoDatasource';

export default class Notifications extends ArangoDatasource {
  constructor() {
    super(DB);
  }

  getNotifications({ _id }, { offset, limit }) {
    if (!_id) throw new Error('User is not logedin');
    const q = aql`
    FOR subject, e, p IN 1..2 ANY ${_id} Follows,Comment,\`Like\`,Reported
    OPTIONS {
    bfs:true,
    uniqueVertices: 'global',
    uniqueEdges: 'path'
    }
    SORT e.createdAt DESC
    LIMIT ${offset},${limit}
    RETURN {action:e, subject , actor:(RETURN DOCUMENT(e._from))[0]}
     `;
    return this.db.query(q).then((arr) => arr.all());
  }
}
