/* eslint-disable no-underscore-dangle */
// import { log } from 'console';
import { GraphQLError } from 'graphql';
import { aql } from 'arangojs';
import DB from '../config/db';
import { uploadFile } from './admin';
import ArangoDataSource from './arangoDatasource/arangoDatasource';

export default class Reports extends ArangoDataSource {
  constructor() {
    super(DB);
    this.reportCol = DB.collection('Reports');
    this.reportedCol = DB.edgeCollection('Reported');
  }

  async createReport({ _id }, {
    country,
    altitude,
    latitude,
    longitude,
    locality,
    subLocality,
    isoCountryCode,
    locationName,
    // enclosures,
    district,
    region,
    text,
    tagName,
  }, file) {
    this.isLogedIn(_id);

    if (!file) throw new Error('Missing media content');
    const {
      createReadStream, filename, mimetype,
    } = await file;
    const stream = createReadStream();
    const fileUrl = await uploadFile(_id, `reports/${_id}${filename}`, mimetype, stream)
      .catch((e) => {
        const { message } = e;
        throw new Error(message || 'Failed to upload file');
      });
    if (!fileUrl) throw new Error('Failed to upload file');

    const createdAt = (new Date()).toISOString();

    const report = await this.reportCol.save(
      {
        country,
        altitude,
        latitude,
        longitude,
        locality,
        subLocality,
        isoCountryCode,
        locationName,
        enclosures: [{ url: fileUrl, type: mimetype }],
        district,
        region,
        text,
        createdAt,
        tagName,
      },
      { returnNew: true },
    )
      .then((res) => this.reportedCol.save({ createdAt }, _id, res)
        .then(() => res.new))
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to create a report');
      });
    return { message: 'Report created successfully', report };
  }

  async editReport(user, {
    _id,
    country,
    altitude,
    latitude,
    longitude,
    locality,
    subLocality,
    isoCountryCode,
    locationName,
    enclosures,
    district,
    region,
    text,
    tagName,
  }) {
    this.isLogedIn(user._id);
    const data = {};
    if (!_id || !(await this.reportCol.documentExists(_id))) { throw new Error('Requested report doesnt exist'); }
    if (country) data.country = country;
    if (altitude !== undefined) data.altitude = altitude;
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (locality) data.locality = locality;
    if (subLocality) data.subLocality = subLocality;
    if (isoCountryCode) data.isoCountryCode = isoCountryCode;
    if (locationName) data.locationName = locationName;
    if (enclosures) data.enclosures = enclosures;
    if (district) data.district = district;
    if (region) data.region = region;
    if (text) data.text = text;
    if (tagName) data.tagName = tagName;
    const report = await this.reportCol.update(_id, data, { returnNew: true })
      .then((res) => res.new).catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to update the report');
      });
    return { message: 'Report Updated successfully', report };
  }

  async deleteReport(user, { _id }) {
    this.isLogedIn(user._id);
    if (!await this.reportCol.documentExists(_id)) throw new GraphQLError('Report doesnt exist');
    const query = aql`
    let reported = ( FOR author,e IN 1..1 INBOUND ${_id} Reported return e)
    let comments = (FOR author,e IN 1..1 INBOUND ${_id} Comment return e)
    let likes = (FOR author,e IN 1..1 INBOUND ${_id} \`Like\` return e)
    let cm = (FOR d IN comments REMOVE d IN Comment)
    let pb = (FOR d IN reported REMOVE d IN Reported)
    let lk = (FOR d IN likes REMOVE d IN \`Like\`)
    FOR report IN Reports
    FILTER report._id == ${_id}
    REMOVE report IN Reports Return report._id
    `;
    return this.db.query(query).then((arr) => arr.next())
      .then((id) => ({ message: 'Report deleted succssesfully', _id: id }))
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to delete the report');
      });
  }

  // eslint-disable-next-line class-methods-use-this
  async getReports({ _id }, {
    id,
    userId,
    isoCountryCode,
    tagName,
    followed,
    cursor,
    offset,
    limit,
  }) {
    const q = [];
    let query;
    this.isLogedIn(_id);
    if (id) {
      query = aql`FOR user,e,p IN 1..1 INBOUND ${id} Reported
      RETURN MERGE(p.vertices[0],{author:user})
      `;
    } else if (userId) {
      q.push(aql`
      FOR report,e,p IN 1..1 OUTBOUND ${userId} Reported
      OPTIONS {
      bfs:true,
      uniqueVertices: 'global',
      uniqueEdges: 'path'
      }`);
      if (cursor && cursor.length) {
        q.push(aql`FILTER`);
        q.push(aql`report.createdAt < ${cursor}`);
      }
      q.push(aql`SORT report.createdAt DESC
        LIMIT ${offset},${limit}
        RETURN MERGE(report,{author:p.vertices[0]})`);
      query = aql.join(q);
    } else if (followed === true) {
      q.push(aql`
      FOR report,e,p IN 1..2 OUTBOUND ${_id} Follows, Reported
      OPTIONS {
      bfs:true,
      uniqueVertices: 'global',
      uniqueEdges: 'path'
      }
      FILTER HAS(report,'text')
      `);
      if (isoCountryCode && isoCountryCode !== '🌎') {
        q.push(aql.literal` AND `);
        q.push(aql`report.isoCountryCode == ${isoCountryCode}`);
      }
      if (tagName) {
        q.push(aql.literal` AND `);
        q.push(aql`report.tagName == ${tagName}`);
      }
      if (cursor && cursor.length) {
        q.push(aql`AND`);
        q.push(aql`report.createdAt < ${cursor}`);
      }
      q.push(aql`
      SORT report.createdAt DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(report,{author:p.vertices[1]})`);
      query = aql.join(q);
    } else if (followed === false) {
      q.push(aql`
        LET friends = (FOR friend IN 1..1 OUTBOUND ${_id} Follows
          OPTIONS {
            bfs:true,
            uniqueVertices: 'global',
            uniqueEdges: 'path'
            }
        FILTER HAS(friend,"username")
        RETURN friend)
        FOR user IN Users
        FILTER user NOT IN friends
        FOR report, e, p IN 1..1 OUTBOUND user Reported
        OPTIONS {
          bfs:true,
          uniqueVertices: 'global',
          uniqueEdges: 'path'
          }
          FILTER HAS(report,'text')
       `);
      if (isoCountryCode && isoCountryCode !== '🌎') {
        q.push(aql.literal`AND`);
        q.push(aql`report.isoCountryCode == ${isoCountryCode}`);
      }
      if (tagName) {
        q.push(aql.literal`AND`);
        q.push(aql`report.tagName == ${tagName}`);
      }
      if (cursor && cursor.length) {
        q.push(aql`AND`);
        q.push(aql`report.createdAt < ${cursor}`);
      }
      q.push(aql`
       SORT report.createdAt DESC
       LIMIT ${offset},${limit}
       RETURN MERGE(report,{author:p.vertices[0]})`);
      query = aql.join(q);
    } else {
      q.push(aql`
      FOR user IN Users
      FOR report,e,p IN 1..1 OUTBOUND user Reported
      OPTIONS {
      bfs:true,
      uniqueVertices: 'global',
      uniqueEdges: 'path'
      }
      FILTER HAS(report,'text')
      `);
      if (isoCountryCode && isoCountryCode !== '🌎') {
        q.push(aql.literal` AND `);
        q.push(aql`report.isoCountryCode == ${isoCountryCode}`);
      }
      if (tagName) {
        q.push(aql.literal` AND `);
        q.push(aql`report.tagName == ${tagName}`);
      }
      if (cursor && cursor.length) {
        q.push(aql`AND`);
        q.push(aql`report.createdAt < ${cursor}`);
      }
      q.push(aql`
      SORT report.createdAt DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(report,{author:p.vertices[1]})`);
      query = aql.join(q);
    }

    return this.db.query(query).then((arr) => arr.all())
      .then((reports) => {
        if (reports.length) {
          const count = reports.length;

          const pageInfo = {
            nextCursor: reports[count - 1].createdAt,
            hasNext: limit === reports.length,
          };
          return { reports, count, pageInfo };
        }
        return { reports: [], count: 0, pageInfo: { nextCursor: null, hasNext: false } };
      })
      .catch((e) => {
        const { message } = e;
        throw new GraphQLError(message || 'Failed to get report');
      });
  }
}
