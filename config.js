
const hostname="localhost"//'192.168.99.100'
module.exports={
Hostname:hostname,
dbHost:"db",
amqpHost:"rabbit",
timeOutSecs:5,
refreshCycle:(30 * 60 * 1000),
RabbitMqSettings:{
    protocol: 'amqp',
    hostname: "rabbit",
    port: 5672,
    username: 'medialook',
    password: 'sosote16',
    vhost: '/',
    //authMechanism: ['PLAIN', 'AMQPLAIN', 'EXTERNAL']
},
ServerConfig:{
    host: "db",
    port: 2424,
    username: 'root',
    password: 'sosote16',
    useToken: true
},
MediaQueue:"mediafeed",
PostQueue:"postfeed"
}