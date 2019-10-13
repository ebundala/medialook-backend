import Dataloader from 'dataloader';
import { aql } from 'arangojs';
import DB from '../config/db';
import combineLoaderRes from './utils';

export default ({ _id }) => {
  const isLiked = (ids) => {
    const query = aql`
        let items= (FOR item IN 1..1 OUTBOUND ${_id} \`Like\` return item)
        FOR item IN ${ids}
        let liked = item IN items[*]._id
        RETURN ZIP([item],[liked])`;

    return DB.query(query).then((arr) => arr.all())
      .then((res) => combineLoaderRes(ids, res)).catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to determine like status');
      });
  };
  return new Dataloader(isLiked);
};
