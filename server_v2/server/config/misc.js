import env from './config';

export default {
  REFRESH_TIME_CYCLE: env.REFRESH_TIME_CYCLE,
  TIMEOUT_IN_SEC: env.TIMEOUT_IN_SEC,
  MEDIA_QUEUE: env.MEDIA_QUEUE,
  POST_QUEUE: env.POST_QUEUE,
  PORT: env.PORT,
  vhost: env.RABBITMQ_DEFAULT_VHOST,
};
