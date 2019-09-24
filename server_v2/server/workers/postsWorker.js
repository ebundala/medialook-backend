/**
 * Created by ebundala on 1/9/2019.
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import '@babel/polyfill';
// import FeedParser from 'davefeedread';
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
  const { feedId, mediaName, post } = data;
  debug(post.author, mediaName, feedId);
  const col = DB.collection('Posts');
  const edgeCol = DB.edgeCollection('Publish');
  return col.save(post)
    .then((doc) => edgeCol
      // eslint-disable-next-line no-underscore-dangle
      .save({ _from: feedId, _to: doc._id }))
    .then((err) => {
      debug(err);
      return err;
    });
};


const parseMediaGroup = (item) => {
  const enclosures = [];
  const group = item['media:group'];
  if (group && group instanceof Array) {
    group.forEach((element) => {
      const content = element['media:content'];
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
  return enclosures.sort((a, b) => {
    if (a.height > b.height) {
      return 1;
    }
    if (a.height === b.height) {
      return 0;
    }
    return -1;
  });
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
    description,
    title,
    enclosures,
    pubDate,
    updatedAt,
  } = post;
  if ((enclosures instanceof Array && !enclosures.filter((item) => item.url).length)
          || (enclosures instanceof Array && !enclosures.length) || !enclosures) {
    debug(`post has no image\n ${post.guid}\n retrying to get from content`);
    enclosures = parseMediaGroup(post);
    if (!enclosures.length) {
      const content = summary + description;
      const imageRegex = new RegExp(/(?<=<img(.*)src=["'])(.+?)(?=["'](.*)>)/igm);
      const videoRegex = new RegExp(/(?<=<source(.*)src=["'])(.+?)(?=["'](.*)>)/igm);

      // eslint-disable-next-line max-len
      // let imageMediaRegex=new RegExp(/(<media(.*)((medium=["'](image)["']){1}|(type=["'](image(.+))["']){1})(.*)>)/);
      // let imageMediaRegexUrl= new RegExp(/(?<=<media(.*)url=["'])(.+?)(?=["'](.*)>)/igm)

      // eslint-disable-next-line max-len
      // let videoMediaRegex=new RegExp(/(<media(.*)((medium=["'](video)["']){1}|(type=["'](video(.+))["']){1})(.*)>)/);
      //  let videoMediaRegexUrl= new RegExp(/(?<=<media(.*)url=["'])(.+?)(?=["'](.*)>)/igm)


      let images = content.toString().match(imageRegex);
      const videos = content.toString().match(videoRegex);
      if (image) {
        const { url } = image;
        if (images instanceof Array && url) { images.push(url); } else if (url) { images = [url]; }
      }

      if (!enclosures) {
        enclosures = [];
      }
      if (images) {
        const probedImages = await Promise
          .all(images.map((item) => reflect(probe(item, { timeout: 30000 }))));
        enclosures.push(...probedImages
          .filter((item) => item.status)
          .filter(({ v }) => v.width >= 200 && v.height >= 200)
          .map(({ v }) => ({
            type: v.mime,
            url: v.url,
            width: v.width,
            height: v.height,
            length: v.length,
          })));
      }
      if (videos) {
        enclosures.push(...videos.map((item) => ({
          type: 'video',
          url: item,
          // "width":null,
          //  "height":null
        })).filter((item) => item.url && item.type));
      }
    }
    debug('images found ');
    debug(enclosures);
  }
  if (title) {
    title = replaceHtml(striptags(title));
  }
  if (summary) {
    summary = replaceHtml(striptags(summary));
  }
  // if (image) {
  // image = image; // JSON.stringify(post.image);
  // }
  /* if (post.enclosures) {
          post.enclosures = JSON.stringify(post.enclosures);
      } */
  if (description) {
    description = replaceHtml(striptags(description));
  }
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
  // return  { sql, params:  };
  return {
    feedId,
    mediaName,
    post: {
      summary,
      createdAt,
      image,
      author,
      link,
      guid,
      description,
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
    .then(() => ch.consume(POST_QUEUE, (msg) => {
      if (msg !== null) {
        const str = msg.content.toString();
        const msgObj = JSON.parse(str);
        buildPost(msgObj).then((data) => savePostToDB(data)
          .then(() => {
            ch.ack(msg);
          }).catch(() => {
            ch.ack(msg);
          }));
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
