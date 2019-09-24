import * as admin from 'firebase-admin';
import credentials from '../../serviceAccount.json';

admin.initializeApp(
  {
    credential: admin.credential.applicationDefault(),
    databaseURL: `https://${credentials.project_id}.firebaseio.com`,
  },
);

export default admin;
