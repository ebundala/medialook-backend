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
    if (!user) throw new Error('User is not loged in');
    if (!query) throw new Error('No search term provided');
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
          url: feed.head.link || link,
          featuredImage: image,
          feedUrl: link,
          feedName: replaceHtml(feed.head.title) || link,

        };

        const result = await this.feedCol.save(media)
          .then((data) => {
            log(data);
            const conditions = media.feedUrl;
            const aquery = aql`
                  FOR doc IN Feeds
                  FILTER doc.feedUrl == ${conditions}
                  RETURN doc
                  `;
            return this.db.query(aquery).then((arr) => arr.all());
          }).catch((e) => {
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
          mediaName: replaceHtml(site.site.title) || site.site.url,
          url: site.site.url,
          featuredImage: site.site.favicon,
          feedUrl: fd.url,
          feedName: replaceHtml(fd.title || site.site.title),
        })).map((fd) => ({ ...fd }));
        const result = await this.feedCol.save(medias).then((data) => {
          log(data);
          // return data.map((item) => item.new);
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
    log('found feeds', feeds);
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
    if (!await this.feedCol.documentExists(_id)) throw new Error('Feed doesnt exist');

    const query = aql`
    LET posts = (FOR post IN 1..1 OUTBOUND ${_id} Publish  return post)
    let publish = ( FOR author,e IN 1..1 OUTBOUND ${_id} Publish  return e)
    let comments = (FOR post IN posts FOR author,e IN 1..1 INBOUND post Comment  return e)
   let likes = (FOR post IN posts FOR author,e IN 1..1 INBOUND post \`Like\` return e)
   let follows = ( FOR author,e IN 1..1 INBOUND ${_id} Follows  return e)
   let pd=( FOR p IN posts REMOVE p IN Posts )
   let cm = (FOR d IN comments REMOVE d IN Comment )
   let pb = (FOR d IN publish REMOVE d IN Publish )
   let lk = (FOR d IN likes REMOVE d IN \`Like\` )
   let fl = (FOR d IN follows REMOVE d IN Follows)
   FOR feed IN Feeds
   FILTER feed._id == ${_id}
   REMOVE feed IN Feeds Return feed._id
    `;
    return this.db.query(query).then((arr) => arr.next())
      .then((id) => ({ message: 'Feed deleted successfully', _id: id }))
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to delete feed');
      });
  }
}
