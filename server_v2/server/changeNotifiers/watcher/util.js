import { Database } from 'arangojs';
import Watcher from './arangoWalWatcher';


const getWalWatcher = ({
  url, database, password, username,
}) => {
  const DB = new Database({
    url,
  });
  DB.useDatabase(database);
  DB.useBasicAuth(username, password);
  return new Watcher(DB);
};
export default getWalWatcher;
