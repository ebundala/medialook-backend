/* eslint-disable no-underscore-dangle */
import { aql } from 'arangojs';
import DB from '../config/db';
import ArangoDataSource from './arangoDatasource/arangoDatasource';

export default class Posts extends ArangoDataSource {
  constructor() {
    super(DB);
    this.postsCol = this.db.collection('Posts');
  }

  getPosts({ _id }, {
    categoryName, countryCode, id, feedId, offset, limit, followed,
  }) {
    if (!_id) throw new Error('User is not logged in');
    const q = [];
    let query;
    if (id) {
      query = aql`
      FOR feed,e,p IN 1..1 INBOUND ${id} Publish 
      RETURN MERGE(p.vertices[0],{feed:feed})
      `;
    } else if (feedId) {
      query = aql`
      FOR post,e,p IN 1..1 OUTBOUND ${feedId} Publish 
        OPTIONS {
        bfs:true,
        uniqueVertices: 'global',
        uniqueEdges: 'path'
        }
        SORT post.pubDate DESC
        LIMIT ${offset},${limit}
        RETURN MERGE(post,{feed:p.vertices[0]})
    `;
    } else if (followed === true) {
      console.log("followed ",followed)
      q.push(aql`FOR post,e,p IN 2..2 OUTBOUND ${_id} Follows, Publish 
        OPTIONS {
        bfs:true,
        uniqueVertices: 'global',
        uniqueEdges: 'path'
        }
        FILTER HAS(post,"title")
        `);
      if (categoryName) {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].categoryName == ${categoryName}`);
      }
      if (countryCode) {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].countryCode == ${countryCode}`);
      }
      q.push(aql`
      SORT post.pubDate DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(post,{feed:p.vertices[1]})`);
      query = aql.join(q);
    } else if(followed === false) {
      console.log("followed ",followed)
      q.push(aql`
      LET myFeeds = (FOR feed IN 1..1 OUTBOUND 
        ${_id} Follows
        OPTIONS {
        bfs:true,
        uniqueVertices: 'global',
        uniqueEdges: 'path'
        }
        FILTER HAS(feed,'feedUrl') == true
        return feed)
        FOR feed IN Feeds 
        Filter feed NOT IN myFeeds
        FOR post,e,p IN 1..1 OUTBOUND feed Publish 
        OPTIONS {
        bfs:true,
        uniqueVertices: 'global',
        uniqueEdges: 'path'
        }   
        FILTER HAS(post,"title")
      `);

      if (categoryName) {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].categoryName == ${categoryName}`);
      }
      if (countryCode) {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].countryCode == ${countryCode}`);
      }
      q.push(aql` 
      SORT post.pubDate DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(post,{feed:p.vertices[0]})`);
      query = aql.join(q);
    }
    else{
      console.log("reached not followed or followed")
      q.push(aql`FOR feed IN Feeds FILTER HAS(feed,"feedUrl")`)
      if (categoryName) {
        q.push(aql`AND`);
        q.push(aql`feed.categoryName == ${categoryName}`);
      }
      if (countryCode) {
        q.push(aql`AND`);
        q.push(aql`feed.countryCode == ${countryCode}`);
      }
      q.push(aql`        
        FOR post,e,p IN 1..1 OUTBOUND feed Publish 
        OPTIONS {
        bfs:true,
        uniqueVertices: 'global',
        uniqueEdges: 'path'
        }   
        FILTER HAS(post,"title")
      `);
      q.push(aql` 
      SORT post.pubDate DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(post,{feed:p.vertices[0]})`);
      query = aql.join(q);
    }
    return this.db.query(query).then((arr) => arr.all())
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to fetch news posts');
      });
  }
}
