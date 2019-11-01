/* eslint-disable no-underscore-dangle */
// eslint-disable-next-line import/no-extraneous-dependencies
import '@babel/polyfill';
import FeedParser from 'davefeedread';
import amqplib from 'amqplib';
// import striptags from 'striptags';
import Express from 'express';
import {
  debug, error, time, timeEnd,
} from 'console';
import misc from '../config/misc';
import DB from '../config/db';
import RabbitMqSettings from '../config/rabbitMq';
import Queue from './Queue';

const app = Express();

const {
  TIMEOUT_IN_SEC, MEDIA_QUEUE, POST_QUEUE, REFRESH_TIME_CYCLE,
} = misc;
const queue = new Queue();
// const queue1 = [];
// const mediasQueue = [];

const fetchFeeds = (feed) => new Promise((resolve, reject) => {
  FeedParser.parseUrl(feed, TIMEOUT_IN_SEC, (e, result) => {
    if (e) {
      reject(e);
    } else {
      resolve(result);
    }
  });
});

const updateFeed = async (feed, posts) => {
  const FeedsCol = DB.collection('Feeds');
  const { feedUrl } = feed;
  const mergeObjects = true;
  const updatedAt = (new Date()).toISOString();
  const result = await FeedsCol
    .updateByExample({ feedUrl }, { updatedAt }, { mergeObjects }).catch((e) => e);
  if (result instanceof Error) {
    error(result);
  }
  // debug('updated feed ', feed._id, feed.mediaName, result);
  return posts;
};


const processFeed = (feed) => fetchFeeds(feed.feedUrl)
  .then((feedContent) => {
    const posts = feedContent.items.map((post) => ({
      // feedUrl: feed.feedUrl,
      feedId: feed._id,
      mediaName: feed.mediaName,
      post,
    })).filter((value) => {
      if (!feed.posts) {
      //  debug('new media processing');
        return true;
      }
      // debug('non new media processing');
      const { post } = value;
      if (post.pubdate && feed.updatedAt) {
        const pubDate = (new Date(post.pubDate)).getTime();
        const lastUpdate = (new Date(feed.updatedAt)).getTime() - REFRESH_TIME_CYCLE;
        const now = (new Date()).getTime();
        return pubDate > lastUpdate && pubDate > (now - (60 * 60 * 24 * 31 * 1000));
      }
      return false;
    });
    // debug(posts.length, ' posts found for ', feed.mediaName);
    return posts;
  }).catch((e) => {
    error('error on network', e);
  });

// media consumer task
let timerHandle;
let isProcessing = false;
const mediaConsumerTask = (timeout = TIMEOUT_IN_SEC) => new Promise((resolve, reject) => {
  try {
    const open = amqplib.connect(RabbitMqSettings);
    resolve(open);
  } catch (e) {
    reject(e);
  }
}).then((conn) => conn.createChannel())
  .then((ch) => {
    ch.assertQueue(MEDIA_QUEUE)
      .then(() => ch.prefetch(10))
      .then(() => {
        timerHandle = setInterval(async () => {
          // debug('queing feeds start');
          if (!queue.isEmpty() && !isProcessing) {
            isProcessing = true;
            time('queing media');
            try {
              while (!queue.isEmpty()) {
                const media = queue.dequeue();
                const json = JSON.stringify(media);
                // eslint-disable-next-line no-await-in-loop
                await ch.sendToQueue(MEDIA_QUEUE, Buffer.from(json));
              }
            } catch (e) {
              debug(e);
            } finally {
              isProcessing = false;
              timeEnd('queing media');
            }
          }
        }, 15000);
      })
      .then(() => ch.consume(MEDIA_QUEUE, async (msg) => {
        if (msg !== null) {
          try {
            const str = msg.content.toString();
            const media = JSON.parse(str);
            // debug('Last feed updated at ', media.updatedAt, media._id);
            await processFeed(media)
              .then((posts) => updateFeed(media, posts))
              .then((posts) => ch.assertQueue(POST_QUEUE)
                .then(() => {
                  if (posts instanceof Array) {
                    // debug('quing posts');
                    posts.forEach((post) => {
                      try {
                        const json = JSON.stringify(post);
                        ch.sendToQueue(POST_QUEUE, Buffer.from(json));
                      } catch (e) {
                        error(e);
                      }
                    });
                  }
                }))
              .catch((e) => {
                debug(e);
              });
          } catch (e) {
            debug(e);
          } finally {
            ch.ack(msg);
          }
        }
        // ch.nack(msg);
      }));
  })
  .catch((e) => {
    error(e);
    debug('wait for next retry in ', timeout / 1000, ' s');
    if (timerHandle) { clearInterval(timerHandle); }
    setTimeout(() => {
      mediaConsumerTask((2 * timeout));
    }, timeout);
  });

const startRefreshLoop = async () => {
  const FeedsCol = DB.collection('Feeds');
  const feeds = await FeedsCol.all().catch((er) => er);

  if (!(feeds instanceof Error)) {
    const feedsArr = await feeds.all().catch((er) => er);
    debug(feedsArr.length);
    if (feedsArr instanceof Array) {
      feedsArr.forEach((media) => {
        queue.enqueue(media);
      });
      debug('refreshing feeds', queue.getLength());
    }
  } else {
    error(feeds);
  }
  // setTimeout(() => {}, REFRESH_TIME_CYCLE);
};
// run main tasks
// mediaQueueTask();
mediaConsumerTask();
// postsProducerTask();
// startRefreshLoop();
let runTask = false;

setInterval(() => {
  if (runTask) {
    runTask = false;
    startRefreshLoop();
  }
}, 15000);

app.get('/refresh', (req, res) => {
  runTask = true;
  res.json({ message: 'ok' });
});

app.listen(5005, () => {
  debug('Media server listens on port 5005');
});

// posts producer task
/* const postsProducerTask = (timeout = TIMEOUT_IN_SEC) => {
  let timerHandle;
  return new Promise((resolve, reject) => {
    try {
      const open = amqplib.connect(RabbitMqSettings);
      resolve(open);
    } catch (e) {
      reject(e);
    }
  }).then((conn) => conn.createChannel())
    .then(async (ch) => ch.assertQueue(POST_QUEUE)
      .then(() => {
        timerHandle = setInterval(() => {
          if (queue1.length) {
            try {
              const msg = queue1.shift();
              const json = JSON.stringify(msg);
              // time("queing post")
              ch.sendToQueue(POST_QUEUE, Buffer.from(json));
            // timeEnd("queing post")
            } catch (e) {
              try {
                ch.close();
              } catch (err) {
                error(err);
              }
              error(e);
              clearInterval(timerHandle);
              postsProducerTask();
            }
          }
        }, 250);
      })).catch((e) => {
      clearInterval(timerHandle);
      error(e);
      debug('wait for next retry in ', timeout / 1000, ' s');
      setTimeout(() => {
        postsProducerTask((2 * timeout));
      }, timeout);
    });
};
 */

// media producer task
/* const mediaQueueTask = (timeout = TIMEOUT_IN_SEC) => {
  let timerHandle;
  return new Promise((resolve, reject) => {
    try {
      const open = amqplib.connect(RabbitMqSettings);
      resolve(open);
    } catch (e) {
      reject(e);
    }
  }).then((conn) => conn.createChannel())
    .then((ch) => ch.assertQueue(MEDIA_QUEUE).then(() => {
      timerHandle = setInterval(() => {
        if (queue.length) {
          time('queing media');
          try {
            const json = JSON.stringify(queue.shift());
            ch.sendToQueue(MEDIA_QUEUE, Buffer.from(json));
          } catch (e) {
            debug(e);
            try {
              ch.close();
            } catch (alreadyClosed) {
              error(alreadyClosed);
            }
            clearInterval(timerHandle);
            mediaQueueTask();
          }

          timeEnd('queing media');
        }
      }, 1000);
    }))
    .catch((e) => {
      clearInterval(timerHandle);
      error(e);
      debug('retrying in ');
      setTimeout(() => {
        debug('retrying ');
        mediaQueueTask(2 * timeout);
      }, timeout);
    });
}; */
/* setInterval(() => {
  if (mediasQueue.length) {
    const media = mediasQueue.shift();
    processFeed(media)
      .then((posts) => updateFeed(media, posts))
      .then((posts) => {
        debug('feed updated success');
        queue1.push(...posts);
      })
      .catch((e) => {
        debug(e);
      });
  }
}, 1000); */
