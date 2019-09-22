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
import { aql } from 'arangojs';
import misc from '../config/misc';
// eslint-disable-next-line no-unused-vars
import DB from '../config/db';
import RabbitMqSettings from '../config/rabbitMq';

import replaceHtml from './utils';

const {
  TIMEOUT_IN_SEC, POST_QUEUE,
} = misc;


const savePostToDB = (query) => {
  // eslint-disable-next-line no-unused-vars
  const { sql, params } = query;
  debug(params);
  return params;
  /* return DB.query(sql, params)
    .then((res) => {
      debug('saved ', res);
    }).catch((e) => {
      error(e.message);
    }); */
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


const buildQuery = async ({ post }) => {
  if ((post.enclosures instanceof Array && !post.enclosures.filter((item) => item.url).length)
          || (post.enclosures instanceof Array && !post.enclosures.length) || !post.enclosures) {
    debug(`post has no image\n ${post.guid}\n retrying to get from content`);
    post.enclosures = parseMediaGroup(post);
    if (!post.enclosures.length) {
      const content = post.summary + post.description;
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
      if (post.image) {
        const { url } = post.image;
        if (images instanceof Array && url) { images.push(url); } else if (url) { images = [url]; }
      }

      if (!post.enclosures) {
        post.enclosures = [];
      }
      if (images) {
        const probedImages = await Promise
          .all(images.map((item) => reflect(probe(item, { timeout: 30000 }))));
        post.enclosures.push(...probedImages
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
        post.enclosures.push(...videos.map((item) => ({
          type: 'video',
          url: item,
          // "width":null,
          //  "height":null
        })).filter((item) => item.url && item.type));
      }
    }
    debug('images found ');
    debug(post.enclosures);
  }
  if (post.title) {
    post.title = replaceHtml(striptags(post.title));
  }
  if (post.summary) {
    post.summary = replaceHtml(striptags(post.summary));
  }
  if (post.image) {
    post.image = JSON.stringify(post.image);
  }
  /* if (post.enclosures) {
          post.enclosures = JSON.stringify(post.enclosures);
      } */
  if (post.description) {
    post.description = replaceHtml(striptags(post.description));
  }
  const sql = aql`
  let post = 
  let publish = 
  return post
  `;
  return { sql, params: post };
};

const postsConsumerTask = (timeout = TIMEOUT_IN_SEC) => new Promise((resolve, reject) => {
  try {
    const open = amqplib.connect(RabbitMqSettings);
    resolve(open);
  } catch (e) {
    reject(e);
  }
}).then((conn) => conn.createChannel())
  .then(async (ch) => ch.assertQueue(POST_QUEUE)
    .then(() => ch.consume(POST_QUEUE, (msg) => {
      if (msg !== null) {
        const str = msg.content.toString();
        const msgObj = JSON.parse(str);
        buildQuery(msgObj).then((query) => savePostToDB(query)
          .then(() => {
            ch.ack(msg);
          }).catch(() => {
            ch.nack(msg);
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
