/* eslint-disable no-unused-vars */
// eslint-disable-next-line import/no-extraneous-dependencies
import '@babel/polyfill';
import { log, table } from 'console';
import express from 'express';
import env from './config/config';
import router from './routes/routes';


const app = express();
app.use(router);
app.listen(env.PORT, () => {
  log(`Server listens on port ${env.PORT}`);
});
