/**
 * Created by ebundala on 1/9/2019.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import '@babel/polyfill';
import amqplib from 'amqplib';
import striptags from 'striptags';
import probe from 'probe-image-size';
import {
  debug, error,
} from 'console';
// import { aql } from 'arangojs';
import misc from '../config/misc';
// eslint-disable-next-line no-unused-vars
import DB from '../config/db';
import RabbitMqSettings from '../config/rabbitMq';

import replaceHtml from './utils';

const {
  TIMEOUT_IN_SEC, POST_QUEUE,
} = misc;

const savePostToDB = (data) => {
  const { feedId, post } = data;
  // debug(post.author, mediaName, feedId);
  const col = DB.collection('Posts');
  const edgeCol = DB.edgeCollection('Publish');
  return col.save(post)
    .then((doc) => edgeCol
      // eslint-disable-next-line no-underscore-dangle
      .save({ _from: feedId, _to: doc._id }))
    .then((res) => res);
};


const parseMediaGroup = (item) => {
  const enclosures = [];
  const group = item['media:group'];
  if (group && group instanceof Array) {
    group.forEach((element) => {
      const content = element['media:content'];
      // const thumbmail = element['media:thumbnail'];
      if (content && content instanceof Array) {
        content.forEach((elem) => {
          const {
            medium, type, height, width, url,
          } = elem['@'];
          if (medium === 'image' || (type && type.toString().match(/image/ig))) {
            if (height > 200 && width > 200) {
              enclosures.push({
                height,
                width,
                type: type || medium,
                url,
              });
            }
          } else if (medium === 'video' || (type && type.toString().match(/video/ig))) {
            enclosures.push({
              height,
              width,
              type: type || medium,
              url,
            });
          }
        });
      }
    });
  }
  return enclosures;
  /* .sort((a, b) => {
       if (a.height * a.width < b.height * b.width) {
      return 1;
    }
    if (a.height === b.height) {
      return 0;
    }
    return -1;
  }); */
};
const reflect = (p) => p.then((v) => ({ v, status: true }),
  (e) => ({ e, status: false }));


const buildPost = async ({ post, mediaName, feedId }) => {
  let {
    summary,
    createdAt,
    // eslint-disable-next-line prefer-const
    image,
    author,
    // eslint-disable-next-line prefer-const
    link,
    // eslint-disable-next-line prefer-const
    guid,
    // eslint-disable-next-line prefer-const
    description,
    title,
    enclosures,
    pubDate,
    updatedAt,
  } = post;
  // eslint-disable-next-line no-underscore-dangle
  if ((await DB.collection('Posts').firstExample({ link }).catch((e) => e))._id) {
    return Promise.reject(new Error('Post already exist'));
  }
  if (!title || !link || !feedId) {
    return null;
  }
  const images = new Set();
  const videos = new Set();
  const urls = new Set();
  if ((enclosures instanceof Array && !enclosures.filter((item) => item.url).length)
          || (enclosures instanceof Array && !enclosures.length) || !enclosures) {
    // debug(`post has no image\n ${post.guid}\n retrying to get from content`);
    parseMediaGroup(post).forEach(({ url }) => {
      if (url) { images.add(url); }
    });
    const content = summary + description;
    const imageRegex = new RegExp(/(?<=<img(.*)src=["'])(.+?)(?=["'](.*)>)/igm);
    const videoRegex = new RegExp(/(?<=<source(.*)src=["'])(.+?)(?=["'](.*)>)/igm);

    // eslint-disable-next-line max-len
    // let imageMediaRegex=new RegExp(/(<media(.*)((medium=["'](image)["']){1}|(type=["'](image(.+))["']){1})(.*)>)/);
    // let imageMediaRegexUrl= new RegExp(/(?<=<media(.*)url=["'])(.+?)(?=["'](.*)>)/igm)

    // eslint-disable-next-line max-len
    // let videoMediaRegex=new RegExp(/(<media(.*)((medium=["'](video)["']){1}|(type=["'](video(.+))["']){1})(.*)>)/);
    //  let videoMediaRegexUrl= new RegExp(/(?<=<media(.*)url=["'])(.+?)(?=["'](.*)>)/igm)


    const matches = content.toString().match(imageRegex);
    if (matches) {
      matches.forEach((url) => {
        urls.add(url);
      });
    }
    const videosMatches = content.toString().match(videoRegex);
    if (videosMatches) {
      videosMatches.forEach((url) => {
        videos.add(url);
      });
    }
  }

  if (image) {
    const { url } = image;
    if (url) {
      images.add(url);
    }
  }

  if (!enclosures) {
    enclosures = [];
  }
  enclosures.forEach(({ url }) => {
    if (url) images.add(url);
  });
  if (urls) {
    urls.forEach((url) => {
      images.add(url);
    });
  }
  if (images) {
    enclosures = [];
    const imagesArr = [];
    images.forEach((item) => {
      imagesArr.push(item);
    });
    const probedImages = await Promise
      .all(imagesArr.map((item) => reflect(probe(item, { timeout: 5000 }))));
    enclosures.push(...probedImages
      .filter(({ v, status }) => status && v.width >= 200
          && v.width <= 1400 && v.height >= 200 && v.height <= 1400)
      .sort((a, b) => {
        if (a.height * a.width < b.height * b.width) {
          return 1;
        }
        if (a.height * a.width === b.height * b.width) {
          return 0;
        }
        return -1;
      })
      .map(({ v }) => ({
        type: v.mime,
        url: v.url,
        width: v.width,
        height: v.height,
        length: v.length,
      })));

    if (videos) {
      const videosArr = [];
      videos.forEach((vid) => {
        videosArr.push(vid);
      });
      enclosures.push(...videosArr.map((item) => ({
        type: 'video',
        url: item,
        // "width":null,
        //  "height":null
      })).filter((item) => item.url && item.type));
    }
  }
  // debug('images found ');
  // debug(enclosures);

  if (title) {
    title = replaceHtml(striptags(title));
  }
  if (summary) {
    summary = replaceHtml(striptags(summary || description));
  }
  // if (image) {
  // image = image; // JSON.stringify(post.image);
  // }
  /* if (post.enclosures) {
          post.enclosures = JSON.stringify(post.enclosures);
      } */
  // if (description) {
  // description = replaceHtml(striptags(description));
  // }
  createdAt = (new Date()).toISOString();
  const now = new Date();
  try {
    let pub = new Date(pubDate);
    if (pub >= now) {
      pub = now;
    }
    updatedAt = pub.toISOString();
    pubDate = updatedAt;
  } catch (e) {
    updatedAt = now.toISOString();
    pubDate = updatedAt;
  }

  if (!author) {
    author = mediaName;
  }

  return {
    feedId,
    mediaName,
    post: {
      summary,
      createdAt,
      // image,
      author,
      link,
      guid,
      // description,
      title,
      enclosures,
      pubDate,
      updatedAt,
    },
  };
};

const postsConsumerTask = (timeout = TIMEOUT_IN_SEC) => new Promise((resolve, reject) => {
  try {
    const open = amqplib.connect(RabbitMqSettings);
    resolve(open);
  } catch (e) {
    reject(e);
  }
}).then((conn) => conn.createChannel())
  .then((ch) => ch.assertQueue(POST_QUEUE)
    .then(() => ch.prefetch(10))
    .then(() => ch.consume(POST_QUEUE, async (msg) => {
      if (msg !== null) {
        try {
          const str = msg.content.toString();
          const post = JSON.parse(str);
          await buildPost(post)
            .then((data) => savePostToDB(data))
            .catch((e) => {
              const { message } = e;
              error(message);
            });
        } catch (e) {
          debug(e);
        } finally {
          ch.ack(msg);
        }
      }
    }))).catch((e) => {
    error(e);
    debug('wait for next retry in ', timeout / 2, ' s');
    setTimeout(() => {
      postsConsumerTask((2 * timeout));
    }, timeout);
  });


// run main task
postsConsumerTask();
