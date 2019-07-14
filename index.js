/**
 * Created by ebundala on 1/4/2019.
 */
const { timeOutSecs, ServerConfig, RabbitMqSettings, MediaQueue, dbHost, PostQueue } = require('./config')
const httpProxy = require('http-proxy');
const apiProxy = httpProxy.createProxyServer();
const Express = require('express');
const RssDiscover = require('rss-finder');
const FeedParser = require("davefeedread");
const validator = require('validator');
const striptags = require("striptags");
const OrientDB = require('orientjs');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount/serviceAccount.json');
const amqplib = require('amqplib');



const mediaQueueTask = (timeout = timeOutSecs) => {
    let timerHandle;
    return new Promise((resolve, reject) => {
        try {
            const open = amqplib.connect(RabbitMqSettings);
            resolve(open);
        }
        catch (e) {
            reject(e);
        }
    }).then(function (conn) {
        return conn.createChannel();
    }).then(function (ch) {

        timerHandle = setInterval(() => {
            if (queue.length) {
                ch.assertQueue(MediaQueue).then((ok) => {
                    console.time("queing media");
                    ch.sendToQueue(MediaQueue, Buffer.from(JSON.stringify(queue.pop())));
                    console.timeEnd("queing media");
                });
            }
        }, 250)

    }).catch((e) => {
        clearInterval(timerHandle);
        console.error(e)
        console.log("retrying in ")
        setTimeout(() => {
            console.log("retrying ")
            mediaQueueTask(2 * timeout);
        }, timeout)
    });

}

const app = Express();
const port = 3000;

let queue = [];

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://medialook.firebaseio.com"
});

app.use((req, res, next) => {
    req.dbServer = OrientDB(ServerConfig);

    req.db = req.dbServer.use({
        name: 'medialook',
        username: 'medialook',
        password: 'medialook'
    });


    next();
});



app.get('/validate/url', (req, res) => {
    let url = req.query.url;
    if (validator.isURL(url)) {

    } else {
        res.json(errorResponse(400, 400, "invalid URL"));
    }

    RssDiscover(url).then((val) => {
        res.json(successResponse(val));
    }).catch((e) => {
        res.json(errorResponse(e.code, e.code, e.message))
    }).finally((e) => {
        console.log("complete " + url);
    })

});

app.get("/validate/feed", (req, res) => {
    let url = req.query.url;
    console.log("validating feed ", url)
    if (validator.isURL(url)) {
        let pr = new Promise((resolve, reject) => {
            FeedParser.parseUrl(url, timeOutSecs, (e, result) => {
                if (e) {
                    reject(e)
                } else {
                    resolve(result)
                }
            })
        }).then((result) => {
            res.json(successResponse(result))
        }).catch((e) => {
            res.json(errorResponse(e.code, e.code, e.message))
        })
    }
    else {
        res.json(errorResponse(400, 400, "invalid url"))
    }

});

app.get("/refreshfeeds", (req, res) => {
    if (!req.db) {
        res.json(errorResponse(400, 400, "failed to connect to database"))
    }
    const sql = "select feedUrl,mediaName,@rid as rid, updatedAt from OMedia ";


    req.db.query(sql).then((medias) => {

        return medias
    })
        .then((medias) => {
            //medias.map((item) => queue.push(item));
            queue = medias;
            res.json(successResponse(medias.length));

        }).catch((e) => {
            console.error(e)
            res.json(errorResponse(e.code, e.code, e.message));
        }).finally(() => {
            console.log("complete getting feeds from medias");
        });



});

app.get("/validate/media", (req, res) => {
    let url = req.query.url;
    let feedUrls = req.query.feedUrl;
    let uid = req.query.uid;
    let sql = "select *,in_OFollow.out[@rid=:uid].size() as followed from OMedia where feedUrl=:feedUrl";
    console.log(url, "\n", feedUrls, "\n", uid);
    req.db.query(sql, { params: { feedUrls: feedUrls, url: url, uid: uid } }).then((result) => {
        res.json(successResponse(result));
    }).catch((e) => {
        res.json(errorResponse(e.code, e.code, e.message));
    }).finally(() => {
        console.log("complete validating ", url);
    })
});


app.post("/signup", createUserWithToken)

//app.get("/migrate", migrate)
app.get("/feeds", getFeeds)

app.all("*", (req, res) => {
    if(!req.headers.authorization){
        res.json(errorResponse("Unauthorized", 401, "no authorization token"))
    }else{
    let authorization = req.headers.authorization
        .split(" ");
    delete req.headers.authorization;
    if (authorization.length == 2) {
        let token = authorization[1]
            
        admin.auth().verifyIdToken(token).then((claims) => {
           
            if (!claims.rid) {
                throw Error("claims dont have rid")
            } else {
                apiProxy.web(req, res, {
                    target: `http://${dbHost}:2480`,
                    auth: `${claims["email"]}:${claims["user_id"]}`,
                    followRedirects: true,
                    xfwd: false
                })
            }

        }).catch((e) => {
            //console.error(errorResponse("the error occured",e.code,401,e.message))
            res.json(errorResponse(e.code, 401, e.message.toString()))
        })

    } else {
        res.json(errorResponse("Unauthorized", 401, "no authorization token"))
    }
  }
})

function addProtocal(url = "") {
    if (!url.startsWith("http", 0)) {
        return "http://" + url;
    }
    return url;
}

function getFeeds(req, res) {
    if (!req.db) {
        res.json(errorResponse(400, 400, "failed to connect to database"))
    }

    let query = req.query.q
    query = query.toString().toLowerCase();

    let rid = req.query.rid;
    let skip = (+req.query.skip);
    let limit = (+req.query.limit);
    console.log("reached", query, rid, skip, limit)
    //in_OFollow.out[@rid=:uid].size()<1
    let sql = `select *,in_OFollow.out[@rid=:uid].size() as followed from OMedia where
     feedUrl.toLowerCase() like "%${query}%" OR mediaName.toLowerCase() like "%${query}%" OR feedName.toLowerCase() like "%${query}%" OR url like "%${query}%"
     order by createdAt desc skip :skip limit :limit`;
    req.db.query(sql, { params: { "query":  query , "uid": rid, "skip": skip, "limit": limit } })
        .then(async (result) => {
            console.log("..............results...........\n",result);
            if (result instanceof Array && result.length > 0) {
                res.json(successResponse(result))
            } else {
                let url = addProtocal(query);
                console.log("checking if url is feed =",url);
                if (validator.isURL(url)) {
                    let feed;
                    feed = await parseFeed(url).catch((e) => {
                        console.log(e);
                        feed = null;
                    });

                    if (feed && feed.head && feed.items) {
                        //handle feed here 
                        //console.log(feed);
                        let image = feed.head.image ? feed.head.image.url : null;
                        let media = {
                            mediaName: feed.head.title,
                            url: feed.head.link,
                            featuredImage: image,
                            feedUrl: url,
                            feedName: feed.head.title

                        }
                        let result;
                        result = await publishMedia([media], req).catch((e) => {
                            console.log(e)
                            //res.json(errorResponse(400, 400, e.message.toString()))
                          return [];
                        })
                        res.json(successResponse(result));
                    }
                    else {
                        let site;
                        site = await RssDiscover(url).catch((e) => {
                            site = null;
                        });
                        console.log("site info \n",site);
                        //todo handle website;
                        if (site && site.feedUrls && site.feedUrls.length) {
                            let medias = site.feedUrls.map((feed) => {
                                return {
                                    mediaName: site.site.title,
                                    url: site.site.url,
                                    featuredImage: site.site.favicon,
                                    feedUrl: feed.url,
                                    feedName: feed.title

                                }
                            });

                            let result;
                            result = await publishMedia(medias, req).catch((e) => {
                                console.log(e)
                               // res.json(errorResponse(400, 400, e.message.toString()))
                               return [];
                            })
                            res.json(successResponse(result));
                        }
                        else {
                            res.json(errorResponse(404, 404, "Nothing was found"))
                        }
                    }

                } else {
                    res.json(errorResponse(404, 404, "Nothing was found"))
                }
            }
        }).catch((e) => {
            console.log(e);
            res.json(errorResponse(e.code, e.code, e.message))
        });
}
function publishMedia(mediaArr, req) {
    return new Promise(async (resolve, reject) => {
        if (mediaArr && mediaArr.length) {
            let sqlArr = mediaArr.map((item, i) => buildFeedSql(item, i).replace(new RegExp("\n", "g"), ""));
            let sql = `begin;
      ${sqlArr.join(";\n")};\n
  let result = select from OMedia where feedUrl like '%${mediaArr.map((item) => item.feedUrl).join("%' OR feedUrl like '%")}%';
      commit retry 5; 
      RETURN $result`

            console.log(sql);
            let result;
            result = await req.db.query(sql, { class: "s" }).catch((e) => {
                reject(e)
            })
            resolve(result);

        }
        reject(new Error("media array is empty"))
    })
}
function parseFeed(url, timeout = timeOutSecs) {
    return new Promise((resolve, reject) => {
        FeedParser.parseUrl(url, timeout, (e, result) => {
            if (e) {
                reject(e)
            } else {
                resolve(result)
            }
        }
        )
    }
    );
}

function createUserWithToken(req, res) {
    if (!req.db) {
        res.json(errorResponse(400, 400, "failed to connect to database"))
    }

    let headers = req.headers
    if (headers.authorization) {
        let authorization = headers.authorization.split(" ")[1];
        console.log(headers.authorization)
        admin.auth().verifyIdToken(authorization).then((claims) => {
            console.log("claims....start.......\n", claims, "\n..........claims.....end\n")
            return admin.auth().getUser(claims.uid).then((userRecord) => {
                // The claims can be accessed on the user record.
                let customClaims = userRecord.customClaims;
                console.log("useridClaims ", customClaims ? customClaims.rid : "")

                if (!(customClaims && customClaims.rid)) {
                    let sql = `INSERT INTO user SET 
               name=:name, 
               password=:password,
               uid=:uid,
               email=:email,
               firstName=:firstName,
               surName=:surName, 
               gender=:gender, 
               dob=:dob ,
               country=:country,
               avator=:avator, 
               status=:status,
               createdAt=sysdate('yyyy-MM-dd HH:mm:ss'),
               roles=(select from ORole where name=:userRole)
               `;

                    let names = [];
                    if (userRecord.displayName) {
                        names = userRecord.displayName.split(" ")
                    }
                    if (!(names.length > 0)) {
                        let emailSubstr = userRecord.email.split("@")
                        names.push(emailSubstr[0])
                    }
                    let params = {
                        "name": userRecord.email,//names.length>0?names[0]:"",
                        "password": userRecord.uid,
                        "uid": userRecord.uid,
                        "email": userRecord.email,
                        "firstName": names.length > 0 ? names[0] : "",
                        "surName": names.length > 1 ? names[1] : "",
                        //"gender":userRecord.,
                        //"dob":userRecord.d,
                        //"country":country,
                        "avator": userRecord.photoURL,
                        "userRole": "admin",
                        "status": "ACTIVE"
                    }
                    return req.db.query(sql, { params }).then((user) => {
                        let recordId = user[0]["@rid"];
                        console.log("new user rid ", user, "\n", recordId)
                        if (recordId) {
                            let rid = `#${recordId.cluster}:${recordId.position}`;

                            return admin.auth().setCustomUserClaims(userRecord.uid, { rid: rid })
                                .then(() => {
                                    res.json(successResponse({ "uid": userRecord.uid, "rid": rid }))
                                })
                        }
                        throw Error("Failed to create user")
                    })
                }
                else {
                    res.json(successResponse({ "uid": claims.uid, "rid": customClaims.rid }))
                }
            });
        }).catch((e) => {
            console.error(e)
            res.json(errorResponse(e.code, e.code, e.message))
        })

    }
    else {
        res.json(errorResponse(401, 401, "Unauthorized"))
    }
}


function buildFeedSql(item, i) {
    return `let q${i} = insert into OMedia set mediaName='${striptags(item.mediaName, "")}', url='${item.url}',
   createdAt=sysdate('yyyy-MM-dd HH:mm:ss'),
 featuredImage='${item.featuredImage}', feedUrl='${item.feedUrl}', feedName='${striptags(item.feedName, "")}'`;
}


function errorResponse(reason, code, content) {
    return [{ "errors": [{ "reason": reason, "code": code, "content": content }] }]

}

function successResponse(data) {
    if (data instanceof Array) {
        if (data.length < 1)
            return [{ "result": [] }];
        else
            return [{ "result": data }];
    }
    return [{ "result": [data] }];

}

app.listen(port, () => console.log(`app listening on port ${port}!`))

//start the media queing;
mediaQueueTask();












function migrate(req, res) {
    if (!req.db) {
        res.json(errorResponse(400, 400, "failed to connect to database"))
    }

    let oldMediasQuery = "select featuredImage,feedUrls,mediaName,url from OMedia";
    req.db.query(oldMediasQuery).then((result) => {
        console.log(result);

        var newFeeds = result.map((item, i, arr) => {
            return item.feedUrls.map((feed, j, feeds) => {
                return {
                    mediaName: item.mediaName,
                    url: item.url,
                    featuredImage: item.featuredImage,
                    feedUrl: feed.url,
                    feedName: feed.title
                }
            })
        })
        let merged = [].concat.apply([], newFeeds);
        let sql = merged.map((item, i) => {
            return buildFeedSql(item, i).replace(new RegExp("\n", "g"), "");
        })
        let newMediaQuery = "begin;\n" +
            sql.join(";\n") + ";\n" +
            "commit retry 5;\n" +
            "return true;" /*+ merged.map((_, i) => {
                return `$q${i}`
            }).join(",") + ";";*/
        console.log(newMediaQuery);
        return req.db.query(newMediaQuery, {
            class: 's',
        })

        //return newMediaQuery;
    }).then((result) => {
        res.json(successResponse(result))
    }).catch((e) => {
        res.json(errorResponse(400, 400, e))
    })
}
