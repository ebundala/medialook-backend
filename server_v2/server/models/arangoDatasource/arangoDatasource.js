import { DataSource } from 'apollo-datasource';
import { InMemoryLRUCache } from 'apollo-server-caching';
import crypto from 'crypto';

/* const Knex = require("knex");
const knexTinyLogger = require("knex-tiny-logger").default; */

const { DEBUG } = process.env;

let hasLogger = false;

export default class ArangoDataSource extends DataSource {
  constructor(db) {
    super();

    // eslint-disable-next-line no-unused-expressions
    this.context;
    // eslint-disable-next-line no-unused-expressions
    this.cache;
    this.db = db;

    // eslint-disable-next-line no-underscore-dangle,no-unused-vars
    const _this = this;
    /* Knex.QueryBuilder.extend("cache", function(ttl) {
      return _this.cacheQuery(ttl, this);
    }); */
  }

  initialize(config) {
    this.context = config.context;
    this.cache = config.cache || new InMemoryLRUCache();

    if (DEBUG && !hasLogger) {
      hasLogger = true; // Prevent duplicate loggers
      // // Add a logging utility for debugging
    }
  }

  // eslint-disable-next-line class-methods-use-this
  parseType(id) {
    if (id) {
      const [type] = id.toString().split('/');
      return type;
    }
    return null;
  }

  cacheQuery(ttl = 5, query) {
    const cacheKey = crypto
      .createHash('sha1')
      .update(query.toString())
      .digest('base64');

    return this.cache.get(cacheKey).then((entry) => {
      if (entry) return Promise.resolve(JSON.parse(entry));

      return query.then((res) => {
        if (res) this.cache.set(cacheKey, JSON.stringify(res), { ttl });

        return Promise.resolve(res);
      });
    });
  }
}
