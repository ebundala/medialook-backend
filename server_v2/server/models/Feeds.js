/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-unused-vars */
import FeedParser from 'davefeedread';
import RssDiscover from 'rss-finder';
import { log } from 'console';
import { isURL } from 'validator';
import { aql } from 'arangojs';
// import { GraphQLError } from 'graphql';
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
    const q = `%${query.toString().toLowerCase()}%`;
    const aq = aql`
                  FOR feed IN Feeds
                  LET q = (${q})
                  FILTER LOWER(feed.feedName) LIKE q
                  OR LOWER(feed.url) like q
                  OR LOWER(feed.feedUrl) like q
                  OR LOWER(feed.mediaName) like q
                  SORT feed.feedName
                  LIMIT ${offset}, ${limit}
                  RETURN feed
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
        const result = await this.feedCol.save(media, { returnNew: true })
          .then((data) => data.new).catch((e) => {
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
        const result = await this.feedCol.save(medias, { returnNew: true }).then((data) => {
          log(data);
          return data.map((item) => item.new);
          // Todo use return new instead of issuing a new query
          /* const conditions = medias.map((fd) => fd.feedUrl);
          const aquery = aql`
                FOR doc IN Feeds
                FILTER doc.feedUrl IN ${conditions}
                RETURN doc
                `;
          return this.db.query(aquery).then((arr) => arr.all()); */
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

  followFeed({ _id }, { to, type }) {
    if (!_id) throw Error('User is not logged in');
    const from = _id;
    if (type === 'DO') {
      const createdAt = (new Date()).toISOString();


      return this.followsCol.save({ createdAt }, from, to).then(async () => {
        const feed = await this.feedCol.document(to).catch((e) => e);
        if (feed instanceof Error) {
          const { message } = feed;
          throw new Error(message || 'Item was not found');
        }
        return { node: feed, message: 'Followed successfully' };
      }).catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to follow');
      });
    }
    if (type === 'UNDO') {
      return this.followsCol.removeByExample({ _from: from, _to: to })
        .then(async () => {
          const feed = await this.feedCol.document(to).catch((e) => e);
          if (feed instanceof Error) {
            const { message } = feed;
            throw new Error(message || 'Feed was not found');
          }
          return { node: feed, message: 'Unfollowed feed successfully' };
        }).catch((e) => {
          const { message } = e;
          throw new Error(message || 'Failed to unfollow Feed');
        });
    }
    throw new Error('Invalid Operation');
  }

  async editFeed({ isAdmin }, {
    _id,
    categoryName, countryCode,
    feedUrl, url, mediaName, feedName, featuredImage,
  }) {
    if (!isAdmin) throw new Error('User has no permission to edit feed');
    const data = {};
    if (categoryName) data.categoryName = categoryName;
    if (countryCode) data.countryCode = countryCode;
    if (feedUrl && isURL(feedUrl)) data.feedUrl = feedUrl;
    if (url && isURL(url)) data.url = url;
    if (mediaName) data.mediaName = mediaName;
    if (feedName) data.feedName = feedName;
    if (featuredImage && isURL(featuredImage)) data.featuredImage = featuredImage;
    data.updatedAt = (new Date()).toISOString();
    const feed = await this.feedCol.update(_id, data, { returnNew: true })
      .then((res) => res.new)
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to update feed');
      });

    return { message: 'Feed updated successfully', feed };
  }

  async deleteFeed({ isAdmin }, { _id }) {
    if (!isAdmin) throw new Error('User has no permission to delete a feed');
    const res = await this.feedCol.remove(_id).catch((e) => {
      const { message } = e;
      throw new Error(message || 'Failed to delete feed');
    });
    return { message: 'Feed deleted successfully', _id };
  }
}
