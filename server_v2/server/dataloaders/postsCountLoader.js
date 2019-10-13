
import Dataloader from 'dataloader';
import { aql } from 'arangojs';
import DB from '../config/db';
import combineLoaderRes from './utils';


const postsCount = (ids) => {
  const query = aql`FOR id In ${ids}
    let itemCn = (FOR item IN 1..1 OUTBOUND id Publish
    COLLECT WITH COUNT INTO itemsCn
    RETURN itemsCn)[0]
    RETURN ZIP([id],[itemCn])`;
  return DB.query(query).then((arr) => arr.all())
    .then((res) => combineLoaderRes(ids, res)).catch((e) => {
      const { message } = e;
      throw new Error(message || 'Failed to get posts count');
    });
};

export default () => new Dataloader(postsCount);
