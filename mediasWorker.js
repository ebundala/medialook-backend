/**
 * Created by ebundala on 1/9/2019.
 */
const { timeOutSecs, refreshCycle, ServerConfig, RabbitMqSettings, MediaQueue, PostQueue } = require('./config')
const OrientDB = require('orientjs');
const FeedParser = require("davefeedread");
const striptags = require('striptags');
const amqplib = require('amqplib');

const Server = OrientDB(ServerConfig)

let queue = [];


const updateFeed = async (feed, posts) => {
    const sql = `update OMedia set updatedAt=sysdate('yyyy-MM-dd HH:mm:ss') where @rid = ${feed.rid}`
    let db = Server.use({
        name: 'medialook',
        username: 'medialook',
        password: 'medialook'
    });
    let res = await db.query(sql);
    console.debug("updated feed ", feed.rid, feed.mediaName, res);
    return posts;
}


function processFeed(media) {
    console.debug("fetching feed ", media.feedUrl);
    return fetchFeeds(media.feedUrl).then((feedContent) => {
        let posts = feedContent.items.map((post, i, _) => {
            return {
                "mediaId": media.rid.toString().replace("#", ""),
                "post": post
            }
        }).filter((value, i) => {
            let { post } = value
            if (post.pubdate && media.updatedAt) {
                let pubDate = (new Date(post.pubDate)).getTime();
                let lastUpdate = (new Date(media.updatedAt)).getTime() - refreshCycle;
                return pubDate > lastUpdate;
            }
            return false
        })
        console.debug(posts.length, " posts found for ", media.mediaName)
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
                    let media = JSON.parse(str);
                    console.debug("Last feed updated at", media.updatedAt, media.rid);
                    return processFeed(media).then((posts) => {
                        return updateFeed(media, posts)
                    }).then((posts) => {
                        console.debug("feed updated success");
                        queue.push.apply(queue, posts);
                        ch.ack(msg);
                    })
                        .catch((e) => {
                            console.debug(e)
                            ch.nack(msg, false, true)
                        })

                }
            });
        });
    }).
        catch((e) => {
            console.error(e);
            console.debug("wait for next retry in ", timeout / 1000, " s")
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
                    // console.time("queing post")
                    ch.sendToQueue(PostQueue, Buffer.from(JSON.stringify(msg)))
                    //console.timeEnd("queing post")
                }
            }, 250)
        });
    }).catch((e) => {
        clearInterval(timerHandle);
        console.error(e);
        console.debug("wait for next retry in ", timeout / 1000, " s")
        setTimeout(() => {
            postsProducerTask((2 * timeout));
        }, timeout)
    });
}


//run main tasks

mediaConsumerTask();
postsProducerTask();
