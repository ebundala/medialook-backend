/* eslint-disable no-unused-vars */
export const createReport = (root, { input },
  { dataSources, user }, info) => dataSources.reports.createReport(user, input);

export const editReport = (root, { input },
  { dataSources, user }, info) => dataSources.reports.editReport(user, input);

export const deleteReport = (root, { input },
  { dataSources, user }, info) => dataSources.reports.deleteReport(user, input);

export const getReports = (root, { input },
  { dataSources, user }, info) => dataSources.reports.getReports(user, input);
