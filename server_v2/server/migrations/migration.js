/* eslint-disable no-empty-pattern */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-duplicates */
// eslint-disable-next-line import/no-extraneous-dependencies
import '@babel/polyfill';
import { log } from 'console';
import { Database } from 'arangojs';
import { dbConfig } from '../config/db';
import feeds from './data/feeds.json';
import reports from './data/report.json';
import countries from './data/country.json';
import tags from './data/tags.json';
import category from './data/category.json';
import posts from './data/posts.json';
import comments from './data/comments.json';
import DB from '../config/db';


DB.useDatabase(dbConfig.database);
DB.useBasicAuth(dbConfig.username, dbConfig.password);
log(dbConfig);
const importMedias = async () => {
  const { result } = feeds;
  const data = result
    .map((item) => {
      const {
        featuredImage,
        feedName,
        countryCode,
        feedUrl,
        createdAt,
        categoryName,
        mediaName,
        url,
        updatedAt,
      } = item;
      const textIndex = `${mediaName} ${url} ${feedUrl} ${feedName}`;
      return {
        textIndex,
        featuredImage,
        feedName,
        countryCode,
        feedUrl,
        createdAt,
        categoryName,
        mediaName,
        url,
        updatedAt,
      };
    });
  const col = DB.collection('Feeds');
  const res = await col.save(data).catch((e) => e);
  if (res instanceof Error) {
    log(res);
  } else {
    log(res);
  }
};
importMedias();

const importCategories = async () => {
  const { result } = category;
  const data = result.map((item) => {
    const { categoryName, importance } = item;
    return { categoryName, importance };
  });
  const col = DB.collection('Categories');
  const res = await col.save(data).catch((e) => e);
  if (res instanceof Error) {
    log(res);
  } else {
    log(res);
  }
};
importCategories();
const importTags = async () => {
  const { result } = tags;
  const data = result.map((item) => {
    const { tagName, importance } = item;
    return { tagName, importance };
  });
  const col = DB.collection('Tags');
  const res = await col.save(data).catch((e) => e);
  if (res instanceof Error) {
    log(res);
  } else {
    log(res);
  }
};
importTags();
const importCountries = async () => {
  const { result } = countries;
  const data = result.map((item) => {
    const {
      continent,
      createdAt,
      flag,
      subRegion,
      admin,
      geometry,
      countryName,
      abbrev,
      iso2,
      iso3,
    } = item;
    return {
      continent,
      createdAt,
      flag,
      subRegion,
      admin,
      geometry,
      countryName,
      abbrev,
      iso2,
      iso3,
    };
  });
  const col = DB.collection('Countries');
  const res = await col.save(data).catch((e) => e);
  if (res instanceof Error) {
    log(res);
  } else {
    log(res);
  }
};
importCountries();

const importPosts = () => {
  const { result } = posts;
  result.map((item) => {
    const {
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
    } = item;
    return {
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
    };
  });
};

const importReports = async () => {
  const { result } = reports;
  const data = result.map((item) => {
    const {
      country,
      altitude,
      locationName,
      subLocality,
      isoCountryCode,
      latitude,
      postalCode,
      locality,
      enclosures,
      createdAt,
      district,
      text,
      region,
      longitude,
    } = item;
    return {
      country,
      altitude,
      locationName,
      subLocality,
      isoCountryCode,
      latitude,
      postalCode,
      locality,
      enclosures,
      createdAt,
      district,
      text,
      region,
      longitude,
    };
  });
  const col = DB.collection('Reports');
  const res = await col.save(data).catch((e) => e);
  if (res instanceof Error) {
    log(res);
  } else {
    log(res);
  }
};
// importReports();
const importComments = () => {
  const { result } = comments;
  result.map((item) => {
    const {
      createdAt,
      text,
    } = item;
    return {};
  });
};
