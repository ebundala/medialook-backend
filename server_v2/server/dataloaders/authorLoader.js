import Dataloader from 'dataloader';
import { aql } from 'arangojs';
import DB from '../config/db';
import combineLoaderRes from './utils';

const author = (ids) => {
  const query = aql`FOR id In ${ids}
      FOR item IN 1..1 INBOUND id Reported
      RETURN zip([id],[item])`;
  return DB.query(query).then((arr) => arr.all())
    .then((res) => combineLoaderRes(ids, res))
    .catch((e) => {
      const { message } = e;
      throw new Error(message || 'Failed to get author');
    });
};

export default () => new Dataloader(author);
