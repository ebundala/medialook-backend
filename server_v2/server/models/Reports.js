// import { log } from 'console';
// import { aql } from 'arangojs';
import { GraphQLError } from 'graphql';
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
}
