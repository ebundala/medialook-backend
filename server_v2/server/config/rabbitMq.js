import env from './config';

export default {
  protocol: 'amqp',
  hostname: env.RABBITMQ_HOST,
  port: env.RABBITMQ_AMQP_PORT,
  username: env.RABBITMQ_DEFAULT_USER,
  password: env.RABBITMQ_DEFAULT_PASS,
  vhost: env.RABBITMQ_DEFAULT_VHOST,
  // authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
};
