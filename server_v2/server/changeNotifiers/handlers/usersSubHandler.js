/* eslint-disable no-console */
import { log } from 'console';

export default (watcher) => {
// node.subscribe({ collection: 'users' });
// node.start();
  watcher.on('Users', (doc, type) => {
  // do something awesome
  // doc:Buffer
  // type:'insert'|'update'|'delete'
    log(type, doc);
  });
};
