const combineLoaderRes = (ids, res) => ids
  .map((id) => res.find((item) => item[id] !== undefined)[id]);

export default combineLoaderRes;
