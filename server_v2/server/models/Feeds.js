/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-unused-vars */
import FeedParser from 'davefeedread';
import RssDiscover from 'rss-finder';
import { log } from 'console';
import { isURL } from 'validator';
import { aql } from 'arangojs';
import msc from '../config/misc';
import DB from '../config/db';
import ArangoDataSource from './arangoDatasource/arangoDatasource';
import replaceHtml from '../workers/utils';

const { TIMEOUT_IN_SEC } = msc;

export default class Feeds extends ArangoDataSource {
  constructor() {
    super(DB);
    this.feedCol = DB.collection('Feeds');
    this.followsCol = DB.edgeCollection('Follows');
  }

  getFeeds(user, { input }) {
    return this.feedCol.byExample(input)
      .then((arr) => arr.all());
  }

  // eslint-disable-next-line class-methods-use-this
  _addProtocal(str) {
    const isLink = str.toString().toLowerCase().startsWith('http');
    if (isLink) {
      return str;
    }
    return `http://${str}`;
  }

  _parseFeed(url, timeout = TIMEOUT_IN_SEC) {
    return new Promise((resolve, reject) => {
      FeedParser.parseUrl(url, timeout, (e, result) => {
        if (e) {
          reject(e);
        } else {
          resolve(result);
        }
      });
    });
  }

  async addFeed(user, { query, offset, limit }) {
    // log(query, offset, limit);
    const aq = aql`
    FOR feed IN FULLTEXT('Feeds','textIndex',${query})
    LIMIT ${offset}, ${limit}
    return feed
    `;
    const feeds = await this.db.query(aq)
      .then((arr) => arr.all()).catch((e) => {
        const { message } = e;
        throw new Error(message || 'Not found');
      });
    const link = this._addProtocal(query);
    if (feeds.length === 0 && isURL(link)) {
      log('Query is a url', link);

      const feed = await this._parseFeed(link).catch((e) => {
        log(e);
        return null;
      });

      if (feed && feed.head && feed.items) {
        // handle feed here
        const image = feed.head.image ? feed.head.image.url : null;
        const media = {
          createdAt: (new Date()).toISOString(),
          mediaName: replaceHtml(feed.head.title),
          url: feed.head.link,
          featuredImage: image,
          feedUrl: link,
          feedName: replaceHtml(feed.head.title),

        };
        const result = await this.feedCol.save(media)
          .then((data) => this.feedCol.document(data)).catch((e) => {
            const { message } = e;
            throw new Error(message || 'Failed to add the feed ');
          });
        return { message: 'Operation succssesfull', feeds: [result] };
      }

      const site = await RssDiscover(link).catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to detect a feed ');
      });

      log('site info \n', site);
      // todo handle website;
      if (site && site.feedUrls && site.feedUrls.length) {
        const medias = site.feedUrls.map((fd) => ({
          createdAt: (new Date()).toISOString(),
          mediaName: replaceHtml(site.site.title),
          url: site.site.url,
          featuredImage: site.site.favicon,
          feedUrl: fd.url,
          feedName: replaceHtml(fd.title || site.site.title),
        })).map((fd) => {
          const textIndex = `${fd.mediaName} ${fd.url} ${fd.feedUrl} ${fd.feedName}`;
          return { textIndex, ...fd };
        });
        const result = await this.feedCol.save(medias).then((data) => {
          log(data);
          const conditions = medias.map((fd) => fd.feedUrl);
          const aquery = aql`
                FOR doc IN Feeds
                FILTER doc.feedUrl IN ${conditions}
                RETURN doc
                `;
          return this.db.query(aquery).then((arr) => arr.all());
        }).catch((e) => {
          const { message } = e;
          throw new Error(message || 'Failed to add the feeds');
        });

        return { message: 'Operation is successfull', feeds: result };
      }

      return { message: 'Nothing was found', feeds: [] };
    }
    return { message: 'Operation is successfull', feeds };
  }
}
