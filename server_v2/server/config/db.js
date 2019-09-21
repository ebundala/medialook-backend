import { Database } from 'arangojs';
import env from './config';

export const dbConfig = {
  url: env.DB_URL, // server url
  database: env.DB_NAME, // db name
  username: env.DB_USER, // db user name
  password: env.DB_PASS, // db password
};


const DB = new Database({
  url: dbConfig.url,
});
DB.useDatabase(dbConfig.database);
DB.useBasicAuth(dbConfig.username, dbConfig.password);
export default DB;
