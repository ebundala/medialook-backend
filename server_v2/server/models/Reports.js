// import { log } from 'console';
// import { aql } from 'arangojs';
import { GraphQLError } from 'graphql';
import { aql } from 'arangojs';
import DB from '../config/db';
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
    enclosures,
    district,
    region,
    text,
    tagName,
  }) {
    if (!_id) throw new GraphQLError('User is not loged in');
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
        enclosures,
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
    if (!user) throw new GraphQLError('User not loged in');
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
    if (!user) throw new GraphQLError('User is not loged in');
    if (!await this.reportCol.documentExists(_id)) throw new GraphQLError('Report doesnt exist');
    await this.reportCol.remove(_id).catch((e) => {
      const { message } = e;
      throw new GraphQLError(message || 'Failed to delete the report');
    });
    return { message: 'Report deleted succssesfully', _id };
  }

  // eslint-disable-next-line class-methods-use-this
  async getReports({ _id }, {
    id,
    userId,
    isoCountryCode,
    tagName,
    followed,
    offset,
    limit,
  }) {
    const q = [];
    let query;
    if (!_id) throw new Error('User is not loged in');
    if (id) {
      query = aql`FOR user,e,p IN 1..1 INBOUND ${id} Reported 
      RETURN MERGE(p.vertices[0],{author:user})
      `;
    } else if (userId) {
      query = aql`
      FOR report,e,p IN 1..1 OUTBOUND ${userId} Reported
      OPTIONS {
      bfs:true,
      uniqueVertices: 'global',
      uniqueEdges: 'path'
      }
      SORT report.createdAt DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(report,{author:p.vertices[0]})`;
    } else if (followed) {
      q.push(aql`
      FOR report,e,p IN 2..2 OUTBOUND ${_id} Follows, Reported
      OPTIONS {
      bfs:true,
      uniqueVertices: 'global',
      uniqueEdges: 'path'
      }
      `);
      if (isoCountryCode || tagName) q.push(aql`FILTER`);
      if (isoCountryCode) {
        q.push(aql`report.isoCountryCode == ${isoCountryCode}`);
      }
      if (tagName) {
        if (q.length > 2) q.push(aql`AND`);
        q.push(aql`report.tagName == ${tagName}`);
      }
      q.push(aql`
      SORT report.createdAt DESC
      LIMIT ${offset},${limit}
      RETURN MERGE(report,{author:p.vertices[1]})`);
      query = aql.join(q);
    } else {
      q.push(aql`
        LET friends = (FOR friend IN 1..1 OUTBOUND ${_id} Follows
          OPTIONS {
            bfs:true,
            uniqueVertices: 'global',
            uniqueEdges: 'path'
            }
        RETURN friend)
        FOR user IN Users 
        FILTER user NOT IN friends
        FOR report, e, p IN 1..1 OUTBOUND user Reported 
        OPTIONS {
          bfs:true,
          uniqueVertices: 'global',
          uniqueEdges: 'path'
          }
       `);
      if (isoCountryCode || tagName) q.push(aql`FILTER`);
      if (isoCountryCode) {
        q.push(aql`report.isoCountryCode == ${isoCountryCode}`);
      }
      if (tagName) {
        if (q.length > 2) q.push(aql`AND`);
        q.push(aql`report.tagName == ${tagName}`);
      }
      q.push(aql`
       SORT report.createdAt DESC
       LIMIT ${offset},${limit}
       RETURN MERGE(report,{author:p.vertices[0]})`);
      query = aql.join(q);
    }

    return this.db.query(query).then((arr) => arr.all());
  }
}
