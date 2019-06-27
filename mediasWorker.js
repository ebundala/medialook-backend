/**
 * Created by ebundala on 1/9/2019.
 */
const { timeOutSecs, refreshCycle,ServerConfig, RabbitMqSettings, MediaQueue, PostQueue } = require('./config')
const OrientDB = require('orientjs');
const FeedParser = require("davefeedread");
const striptags = require('striptags');
const amqplib = require('amqplib');

const Server=OrientDB(ServerConfig)

let queue = [];



//media consumer task
const mediaConsumerTask = (timeout = timeOutSecs) => {
    return new Promise((resolve, reject) => {
        try {
            const open = amqplib.connect(RabbitMqSettings);
            resolve(open)
        }
        catch (e) {
            reject(e)
        }
    }
    ).then((conn) => {
        return conn.createChannel();
    }).then((ch) => {
        return ch.assertQueue(MediaQueue).then((ok) => {
            return ch.consume(MediaQueue, (msg) => {
                if (msg !== null) {
                    let str = msg.content.toString()
                    console.debug(str);
                    let media = JSON.parse(str);
                    console.debug(media);
                    return processFeed(media).then( async (q) => {
                        queue.push.apply(queue, q);
                        await updatedAt(media)
                        ch.ack(msg);
                    }).catch((_) => {
                        ch.ack(msg)
                    })

                }
            });
        });
    }).
        catch((e) => {
            console.error(e);
            console.debug("wait for next retry ")
            setTimeout(() => {
                mediaConsumerTask((2 * timeout));
            }, timeout)
        });
}

//posts producer task
const postsProducerTask = (timeout = timeOutSecs) => {
    let timerHandle;
    return new Promise((resolve, reject) => {
        try {
            const open = amqplib.connect(RabbitMqSettings);
            resolve(open)
        }
        catch (e) {
            reject(e)
        }

    }).then((conn) => {
        return conn.createChannel();
    }).then(async (ch) => {
        return ch.assertQueue(PostQueue).then((ok) => {
            timerHandle = setInterval(() => {
                if (queue.length) {
                    let msg = queue.pop();
                    console.time("queing post")
                    ch.sendToQueue(PostQueue, Buffer.from(JSON.stringify(msg)))
                    console.timeEnd("queing post")
                }
            }, 250)
        });
    }).catch((e) => {
        clearInterval(timerHandle);
        console.error(e);
        console.debug("wait for next retry ")
        setTimeout(() => {
            postsProducerTask((2 * timeout));
        }, timeout)
    });
}

function updatedAt(feed){
    const sql=`update OMedia set updatedAt=sysdate('yyyy-MM-dd HH:mm:ss') where @rid=${feed.rid.toString().replace("#", "")}`
    const db = Server.use({
        name: 'medialook',
        username: 'medialook',
        password: 'medialook'
    });
    return db.query(sql);
}


function processFeed(media) {
    console.debug("fetching feed ", media.feedUrl);
    return fetchFeeds(media.feedUrl).then((feedContent) => {
        let posts= feedContent.items.map((post, i, _) => {
            return {
            "mediaId": media.rid.toString().replace("#", ""),
             "post": post
            }
        }).filter(({post},i)=>{
            if(post.pubdate&&media.updatedAt){
            let pubDate= (new Date(post.pubDate)).getTime();
            updatedAt= (new Date(media.updatedAt)).getTime()-refreshCycle;
            //console.debug("........................dates ",pubDate,updatedAt," end ......................................")
           return  pubDate>updatedAt;
        }
            return false
        })
        console.debug(posts.length," posts found for ",media.mediaName)
        return posts;
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
