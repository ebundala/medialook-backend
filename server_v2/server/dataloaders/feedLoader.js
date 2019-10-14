import Dataloader from 'dataloader';
import { aql } from 'arangojs';
import DB from '../config/db';
import combineLoaderRes from './utils';

const feed = (ids) => {
  const query = aql`FOR id In ${ids}
      FOR item IN 1..1 INBOUND id Publish
      RETURN zip([id],[item])`;
  return DB.query(query).then((arr) => arr.all())
    .then((res) => combineLoaderRes(ids, res))
    .catch((e) => {
      const { message } = e;
      throw new Error(message || 'Failed to get feed');
    });
};

export default () => new Dataloader(feed);
