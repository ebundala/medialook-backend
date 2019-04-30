/**
 * Created by ebundala on 1/9/2019.
 */
const {timeOutSecs,ServerConfig,RabbitMqSettings,MediaQueue,PostQueue}=require('./config')
//const validator = require('validator');
const OrientDB = require('orientjs');
const FeedParser = require("davefeedread");
const striptags = require('striptags');
//const amqp = require('amqplib/callback_api');
const amqplib=require('amqplib');


let queue=[];



//media consumer task
const mediaConsumerTask=(timeout=timeOutSecs)=>{
    try{
const open = amqplib.connect(RabbitMqSettings);

open.then((conn) => {
    return conn.createChannel();
}).then(async (ch) => {    
    
    return ch.assertQueue(MediaQueue).then((ok) => {
        return ch.consume(MediaQueue, (msg) => {
            if (msg !== null) {
                let str = msg.content.toString()
                console.log(str);
                let media = JSON.parse(str);
                console.log(media);
                return processFeed(media).then((q) => {
                     queue.push.apply(queue,q);
                    ch.ack(msg);
                }).catch((_)=>{
                    ch.ack(msg)
                })

            }
        });
    });
}).catch(console.error);
  
}
catch(e){
    console.error(e);
    console.log("wait for next retry ")
    setTimeout(()=>{
        mediaConsumerTask((2*timeout));
    },50*timeout)
}
}

//posts producer task
const postsProducerTask=(timeout=timeOutSecs)=>{
    try{
const open = amqplib.connect(RabbitMqSettings);
let timerHandle;
open.then((conn) => {
    return conn.createChannel();
}).then(async (ch) => {    
    return ch.assertQueue(PostQueue).then((ok) => {
    timerHandle=setInterval(()=>{
        if(queue.length){
            let msg = queue.pop();
         console.time("queing post")
        ch.sendToQueue(PostQueue,Buffer.from(JSON.stringify(msg)))
        console.timeEnd("queing post")
        }
    },250)
    });
}).catch((e)=>{    
    clearInterval(timerHandle);
    console.error(e)
    throw e;
});
  
}
catch(e){
    console.error(e);
    console.log("wait for next retry ")    
    setTimeout(()=>{
        postsProducerTask((2*timeout));
    },50*timeout)
}
}



function processFeed(media) {
    console.log("fetching feed ", media.feedUrl);
    return fetchFeeds(media.feedUrl).then((feedContent) => {
        
      return feedContent.items.map((post, i, _) => {
        return {"mediaId":media.rid.toString().replace("#",""),"post":post} //buildQuery(post, media, categories);
     })

    });
}



function fetchFeeds(feed) {
    return new Promise((resolve, reject) => {
        FeedParser.parseUrl(feed, timeOutSecs, (e, result) => {
            if (e) {
                reject(e)
            } else {
                resolve(result)
            }
        })
    })
}


//run main tasks

mediaConsumerTask();
postsProducerTask();





/*
amqp.connect(rabitmqSettings, function (err, conn) {
    if (err) {
        console.log(err)
    } else {
        conn.createChannel(function (err, ch) {
            var q = 'medialook';

            ch.assertQueue(q, { durable: true }, (err, ok) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q);
                    ch.consume(q, function (msg) {
                        console.log(" [x] Received %s", msg.content.toString());
                    }, { noAck: true });
                }
            });
        });
    }
});*/