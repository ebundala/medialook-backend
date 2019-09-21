
export default (watchers) => {
  watchers.subscribe({ collection: 'users' });
  return watchers;
};
