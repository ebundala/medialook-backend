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

const app = Express();

const {
  TIMEOUT_IN_SEC, MEDIA_QUEUE, POST_QUEUE, REFRESH_TIME_CYCLE,
} = misc;
const queue = [];
const queue1 = [];

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
  debug('updated feed ', feed._id, feed.mediaName, result);
  return posts;
};


const processFeed = (feed) => {
  debug('fetching feed ', feed.feedUrl);
  return fetchFeeds(feed.feedUrl).then((feedContent) => {
    const posts = feedContent.items.map((post) => ({
      // feedUrl: feed.feedUrl,
      feedId: feed._id,
      mediaName: feed.mediaName,
      post,
    })).filter((value) => {
      if (!feed.posts) {
        debug('new media processing');
        return true;
      }
      debug('non new media processing');
      const { post } = value;
      if (post.pubdate && feed.updatedAt) {
        const pubDate = (new Date(post.pubDate)).getTime();
        const lastUpdate = (new Date(feed.updatedAt)).getTime() - REFRESH_TIME_CYCLE;
        return pubDate > lastUpdate;
      }
      return false;
    });
    debug(posts.length, ' posts found for ', feed.mediaName);
    return posts;
  });
};

// media producer task
const mediaQueueTask = (timeout = TIMEOUT_IN_SEC) => {
  let timerHandle;
  return new Promise((resolve, reject) => {
    try {
      const open = amqplib.connect(RabbitMqSettings);
      resolve(open);
    } catch (e) {
      reject(e);
    }
  }).then((conn) => conn.createChannel()).then((ch) => {
    timerHandle = setInterval(() => {
      if (queue.length) {
        ch.assertQueue(MEDIA_QUEUE).then(() => {
          time('queing media');
          ch.sendToQueue(MEDIA_QUEUE, Buffer.from(JSON.stringify(queue.pop())));
          timeEnd('queing media');
        });
      }
    }, 1000);
  }).catch((e) => {
    clearInterval(timerHandle);
    error(e);
    debug('retrying in ');
    setTimeout(() => {
      debug('retrying ');
      mediaQueueTask(2 * timeout);
    }, timeout);
  });
};

// media consumer task
const mediaConsumerTask = (timeout = TIMEOUT_IN_SEC) => new Promise((resolve, reject) => {
  try {
    const open = amqplib.connect(RabbitMqSettings);
    resolve(open);
  } catch (e) {
    reject(e);
  }
}).then((conn) => conn.createChannel())
  .then((ch) => ch.assertQueue(MEDIA_QUEUE)
    .then(() => ch.consume(MEDIA_QUEUE, (msg) => {
      if (msg !== null) {
        const str = msg.content.toString();
        const media = JSON.parse(str);
        debug('Last feed updated at', media.updatedAt, media._id, media.posts, media);
        processFeed(media)
          .then((posts) => updateFeed(media, posts))
          .then((posts) => {
            debug('feed updated success');
            queue1.push(...posts);
            ch.ack(msg);
          })
          .catch((e) => {
            debug(e);
            ch.nack(msg, false, false);
          });
      }
    })))
  .catch((e) => {
    error(e);
    debug('wait for next retry in ', timeout / 1000, ' s');
    setTimeout(() => {
      mediaConsumerTask((2 * timeout));
    }, timeout);
  });

// posts producer task
const postsProducerTask = (timeout = TIMEOUT_IN_SEC) => {
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
            const msg = queue1.pop();
            // time("queing post")
            ch.sendToQueue(POST_QUEUE, Buffer.from(JSON.stringify(msg)));
            // timeEnd("queing post")
          }
        }, 500);
      })).catch((e) => {
      clearInterval(timerHandle);
      error(e);
      debug('wait for next retry in ', timeout / 1000, ' s');
      setTimeout(() => {
        postsProducerTask((2 * timeout));
      }, timeout);
    });
};

const startRefreshLoop = async () => {
  const FeedsCol = DB.collection('Feeds');
  const feeds = await FeedsCol.all().catch((er) => er);

  if (!(feeds instanceof Error)) {
    const feedsArr = await feeds.all().catch((er) => er);
    debug(feedsArr);
    if (feedsArr instanceof Array) {
      queue.push(...feedsArr);
      // debug(TIMEOUT_IN_SEC, MEDIA_QUEUE, POST_QUEUE, REFRESH_TIME_CYCLE, RabbitMqSettings);
    }
  } else {
    error(feeds);
  }
  // setTimeout(() => {}, REFRESH_TIME_CYCLE);
};
// run main tasks
mediaQueueTask();
mediaConsumerTask();
postsProducerTask();
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
