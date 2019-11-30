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
    categoryName, countryCode, id, feedId, offset, limit, followed, cursor,
  }) {
    this.isLogedIn(_id);
    const q = [];
    let query;
    if (id) {
      query = aql`
      FOR feed,e,p IN 1..1 INBOUND ${id} Publish 
      RETURN MERGE(p.vertices[0],{feed:feed})
      `;
    } else if (feedId) {
      q.push(aql`
      FOR post,e,p IN 1..1 OUTBOUND ${feedId} Publish 
        OPTIONS {
        bfs:true,
        uniqueVertices: 'global',
        uniqueEdges: 'path'
        }`);

      if (cursor && cursor.length) {
        q.push(aql`FILTER`);
        q.push(aql`post.pubDate > ${cursor}`);
      }
      q.push(aql`SORT post.pubDate DESC
        LIMIT ${offset},${limit}
        RETURN MERGE(post,{feed:p.vertices[0]})
       `);
      query = aql.join(q);
    } else if (followed === true) {
      q.push(aql`FOR post,e,p IN 2..2 OUTBOUND ${_id} Follows, Publish 
        OPTIONS {
        bfs:true,
        uniqueVertices: 'global',
        uniqueEdges: 'path'
        }
        FILTER HAS(post,"title")
        `);
      if (categoryName && categoryName !== 'All') {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].categoryName == ${categoryName}`);
      }
      if (countryCode && countryCode !== '🌎') {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].countryCode == ${countryCode}`);
      }
      if (cursor && cursor.length) {
        q.push(aql`AND`);
        q.push(aql`post.pubDate < ${cursor}`);
      }
      q.push(aql`
      SORT post.pubDate DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(post,{feed:p.vertices[1]})`);
      query = aql.join(q);
    } else if (followed === false) {
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

      if (categoryName && categoryName !== 'All') {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].categoryName == ${categoryName}`);
      }
      if (countryCode && countryCode !== '🌎') {
        q.push(aql`AND`);
        q.push(aql`p.vertices[1].countryCode == ${countryCode}`);
      }
      if (cursor && cursor.length) {
        q.push(aql`AND`);
        q.push(aql`post.pubDate < ${cursor}`);
      }
      q.push(aql` 
      SORT post.pubDate DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(post,{feed:p.vertices[0]})`);
      query = aql.join(q);
    } else {
      q.push(aql`FOR feed IN Feeds FILTER HAS(feed,"feedUrl")`);
      if (categoryName && categoryName !== 'All') {
        q.push(aql`AND`);
        q.push(aql`feed.categoryName == ${categoryName}`);
      }
      if (countryCode && countryCode !== '🌎') {
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
      if (cursor && cursor.length) {
        q.push(aql`AND`);
        q.push(aql`post.pubDate < ${cursor}`);
      }
      q.push(aql` 
      SORT post.pubDate DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(post,{feed:p.vertices[0]})`);
      query = aql.join(q);
    }
    return this.db.query(query).then((arr) => arr.all())
      .then((posts) => {
        if (posts.length) {
          const count = posts.length;

          const pageInfo = {
            nextCursor: posts[count - 1].pubDate,
            hasNext: limit === posts.length,
          };
          return { posts, count, pageInfo };
        }
        return { posts: [], count: 0, pageInfo: { nextCursor: null, hasNext: false } };
      })
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to fetch news posts');
      });
  }
}
