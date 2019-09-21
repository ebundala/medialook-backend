import { error } from 'console';
import { dbConfig } from '../config/db';
import getWalWatcher from './watcher/util';
import usersSubscriptions from './subscribers/users';
import usersSubHandler from './handlers/usersSubHandler';

const watcher = getWalWatcher(dbConfig);
// add subscriptions here
usersSubscriptions(watcher);

// start the watcher
watcher.start();
// handle errors and restart watcher
// eslint-disable-next-line no-unused-vars
watcher.on('error', (err, _httpStatus, _headers, _body) => {
  // watcher stops on errors
  // check last http request
  error(err);
  watcher.start();
});

// attach subscriptions handlers
usersSubHandler(watcher);
