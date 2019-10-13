import Dataloader from 'dataloader';
import { aql } from 'arangojs';
import DB from '../config/db';
import combineLoaderRes from './utils';

export default ({ _id }) => {
  const isFollowed = (ids) => {
    const query = aql`
        let items= (FOR item IN 1..1 OUTBOUND ${_id} Follows return item)
        FOR item IN ${ids}
        let followed = item IN items[*]._id
        RETURN ZIP([item],[followed])`;

    return DB.query(query).then((arr) => arr.all())
      .then((res) => combineLoaderRes(ids, res))
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to get followings');
      });
  };
  return new Dataloader(isFollowed);
};
