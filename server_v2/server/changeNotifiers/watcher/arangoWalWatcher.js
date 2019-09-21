
/* eslint-disable no-console */
/* eslint-disable max-len */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
/* eslint-disable no-shadow */
/* eslint-disable consistent-return */
/* eslint-disable no-underscore-dangle */

const EventEmitter = require('events');

class Watcher extends EventEmitter {
  constructor(Db) {
    super();
    this.api = Db.route('/_api');


    // eslint-disable-next-line no-underscore-dangle
    this._loggerStatePath = '/wal/lastTick';
    this._loggerFollowPath = '/wal/tail';
    this._collectionsInfoPath = '/collection';
    this.collectionsMap = new Map();
    this.collections = new Map();
    this._stopped = false;
  }

  start() {
    this._stopped = false;
    this.api.get(this._collectionsInfoPath)
      .then(({ body, statusCode }) => {
        if (statusCode !== 200 || body.error === true) {
          throw Error('DB_COLLECTIONS_NOTFOUND');
        }
        const { result } = body;
        for (let i = 0; i < result.length; i += 1) {
          const col = result[i];
          const { globallyUniqueId, name } = col;
          this.collections.set(globallyUniqueId, name);
        }
        this._startLoggerState();
      })
      .catch((e) => {
        console.error(e);
        setTimeout(this._startLoggerState, 5000);
      });
  }

  stop() {
    this._stopped = true;
  }

  _startLoggerState() {
    this.api.get(this._loggerStatePath).then(({ statusCode, headers, body }) => {
      if (statusCode !== 200) {
        throw Error({ statusCode, headers, body });
      }

      let lastLogTick = body.tick;
      let type;
      let tid;
      let entry;
      console.log(body);
      const txns = new Map();
      const handleEntry = () => {
        const { data, cuid, cname } = entry;

        const collectionName = cname || (data._id ? data._id.split('/')[0] : this.collections.get(cuid));

        const colConf = this.collectionsMap.get(collectionName);

        if (undefined === colConf) return;

        const events = colConf.get('events');
        const event = this.inferEventType(tid, type);

        if (events.size !== 0 && !events.has(event)) return;

        const key = entry.data._key;
        const keys = colConf.get('keys');

        if (keys.size !== 0 && !events.has(key)) return;

        const doc = entry.data;

        this.emit(collectionName, doc, event);
      };

      const ticktock = () => {
        if (this._stopped) return;
        this.api.get(this._loggerFollowPath, { from: lastLogTick }).then(({ statusCode, headers, body }) => {
          if (statusCode > 204 || statusCode === 0) {
            this.emit('error', new Error('E_WALLTAIL'), statusCode, headers, body);
            this.stop();
            return;
          }
          if (headers['x-arango-replication-lastincluded'] === '0') {
            return setTimeout(ticktock, 5000);
          }

          lastLogTick = headers['x-arango-replication-lastincluded'];

          const entries = body.toString().trim().split('\n');

          for (let i = 0; i < entries.length; i += 1) {
            entry = JSON.parse(entries[i]);

            // transaction   {"tick":"514132959101","type":2200,"tid":"514132959099","database":"1"}
            // insert/update {"tick":"514092205556","type":2300,"tid":"0","database":"1","cid":"513417247371","cname":"test","data":{"_id":"test/testkey","_key":"testkey","_rev":"514092205554",...}}
            // delete        {"tick":"514092206277","type":2302,"tid":"0","database":"1","cid":"513417247371","cname":"test","data":{"_key":"abcdef","_rev":"514092206275"}}

            type = entry.type;
            tid = entry.tid;
            if (type === 2200) { // txn start
              txns.set(tid, new Set());
            } else if (type === 2201) { // txn commit and replay docs
              // eslint-disable-next-line no-restricted-syntax
              for (const data of txns.get(tid)) {
                [type, entry] = data;
                handleEntry();
              }
              txns.delete(tid);
            } else if (type === 2002) { // txn abort
              txns.delete(tid);
            } else if ((type === 2300 || type === 2302) && tid === '0') {
              handleEntry();
            } else if (tid !== '0') {
              txns.get(tid).add([type, entry]);
            }
          }
          ticktock();
        });
      };
      ticktock();
    }).catch(({ body, headers, statusCode }) => {
      this.emit('error', new Error('E_LOGGERSTATE'), statusCode, headers, body);
      this.stop();
    });
  }

  // eslint-disable-next-line class-methods-use-this
  inferEventType(tid, type) {
    if (type === 2300) { // type 2300 means insert or update
      return tid === '0' ? 'insert' : 'update'; // the tid tells us which of the above it is
    }

    if (type === 2302) { // type 2302 means delete
      return 'delete';
    }
  }

  subscribe(confs) {
    // eslint-disable-next-line no-param-reassign
    if (typeof confs === 'string') confs = { collection: confs };
    if (!Array.isArray(confs)) confs = [confs];

    // eslint-disable-next-line no-restricted-syntax
    for (const conf of confs) {
      let colConfMap;

      if (this.collectionsMap.has(conf.collection)) {
        colConfMap = this.collectionsMap.get(conf.collection);
      } else {
        colConfMap = new Map([['events', new Set()], ['keys', new Set()]]);
        this.collectionsMap.set(conf.collection, colConfMap);
      }

      if (conf.events) {
        for (const event of conf.events) {
          colConfMap.get('events').add(event);
        }
      }

      if (conf.keys) {
        for (const key of conf.keys) {
          colConfMap.get('keys').add(key);
        }
      }
    }
  }

  unsubscribe(confs) {
    if (typeof confs === 'string') confs = { collection: confs };
    if (!Array.isArray(confs)) confs = [confs];

    for (const conf of confs) {
      if (conf.events) {
        const events = this.collectionsMap.get(conf.collection).get('events');
        for (const event of conf.events) {
          events.delete(event);
        }
      }
      if (conf.keys) {
        const keys = this.collectionsMap.get(conf.collection).get('keys');
        for (const key of conf.keys) {
          keys.delete(key);
        }
      }

      if (!conf.events && !conf.keys) {
        this.collectionsMap.delete(conf.collection);
      }
    }
  }
}
export default Watcher;
