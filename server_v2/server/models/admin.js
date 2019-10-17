import * as admin from 'firebase-admin';
import credentials from '../../serviceAccount.json';

admin.initializeApp(
  {
    credential: admin.credential.applicationDefault(),
    databaseURL: `https://${credentials.project_id}.firebaseio.com`,
    storageBucket: 'medialook.appspot.com',
  },
);

export default admin;

export const uploadFile = (_id, filename, mimetype, stream) => {
  const storage = admin.storage();
  const file = storage.bucket().file(filename);
  const options = {
    gzip: true,
    resumable: false,
    metadata: {
      contentType: mimetype,
      metadata: {
        author: _id,
      },
    },
  };
  return new Promise((resolve, reject) => {
    stream.pipe(file.createWriteStream(options))
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', () => {
        // The file upload is complete.
        file.getSignedUrl({
          action: 'read',
          expires: '03-09-2087',
        }).then(([url]) => { resolve(url); })
          .catch((e) => reject(e));
      });
  })
    .then((url) => url);
};
