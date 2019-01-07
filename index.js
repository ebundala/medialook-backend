/**
 * Created by ebundala on 1/4/2019.
 */
const Express =require('express');
const Parser =require('rss-parser');
const RssDiscover=require('rss-finder');
const FeedParser=require("davefeedread");
const validator = require('validator');
const OrientDB = require('orientjs');
const SequentialTaskQueue=require('sequential-task-queue').SequentialTaskQueue;
const app = Express();
const port = 3000;
const timeOutSecs = 30;

const mediaQueue = new SequentialTaskQueue();
const feedsQueue = new SequentialTaskQueue();
const postQueue = new SequentialTaskQueue();
let queue=[];
app.use((req,res,next)=>{
    req.dbServer = OrientDB({
        host:     'localhost',
        port:     2424,
        username: 'root',
        password: 'kiazi',
        useToken: true
    });

    req.db = req.dbServer.use({
        name:     'medialook',
        username: 'medialook',
        password: 'medialook'
    });


    next();
});

setInterval(()=>{
    if(queue.length){
        console.time("refreshing");
        let result=queue.pop();
        processRefresh(result);
        console.timeEnd("refreshing");
    }
},5000)

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
        console.log("complete "+url);
    })

});

app.get("/validate/feed",(req,res)=>{
    let url=req.query.url;
    if(validator.isURL(url)){
        let pr= new Promise((resolve,reject)=>{
            FeedParser.parseUrl(url,timeOutSecs,(e,result)=>{
                if(e){
                    reject(e)
                }else{
                   resolve(result)
                }
            })
       }).then((result)=>{
                res.json(successResponse(result.items[0]))
            }).catch((e)=>{
                res.json(errorResponse(e.code,e.code,e.message))
            })


    }
    else{
        res.json(errorResponse(400,400,"invalid url"))
    }

});

app.get("/refreshfeeds",(req,res)=>{
    if(!req.db){
        res.json(errorResponse(400,400,"failed to connect to database"))
    }
    const sql="select feedUrls,mediaName,@rid from OMedia ";
    req.db.query(sql).then((result)=>{
        queue.push(result);
        res.json(successResponse(result.length));

    }).catch ((e)=>{
        console.error(e)
        res.json(errorResponse(e.code,e.code,e.message));
    }).finally(()=>{
        console.log("complete getting feeds from medias");
    });



});


function processRefresh(result){
    console.log(result.length);
    result.map((media,i,all)=>{
        mediaQueue.push(()=>{
            console.log("process media ",i)
            media.feedUrls=JSON.parse(media.feedUrls);
            media.feedUrls.map((feed,i,_feeds)=>{
                feedsQueue.push(()=>{
                    console.log("feching feed ",i);
                    fetchFeeds(feed).then((feedContent)=>{
                        feedContent.items.map((post,i,posts)=>{
                            postQueue.push(()=>{
                                savePostToDB(post,media);

                            })
                        })

                    });



                })

            })
        });
    });

}

function savePostToDB(post,media) {

    const Server = OrientDB({
        host:     'localhost',
        port:     2424,
        username: 'root',
        password: 'kiazi',
        useToken: true
    });

    const db = Server.use({
        name:     'medialook',
        username: 'medialook',
        password: 'medialook'
    });


    let query=buildQuery(post,media);
   return db.query(query.sql,
        {   class: 's',
            params:query.params
        }).then((res)=>{
        console.log(res[0].title);
    }).catch((e)=>{
       console.error(e.message)
   })

}

function buildQuery(post,media){
    let sql="begin;\n" +
        "let a=select from OPost where ";

    if(post.guid){
        sql=sql+"guid=':guid'";

    }
    else{
        sql=sql+"link=':link'";
    }
    sql=sql+";\n"+
    "if($a.size()>0){\n"+
        "ROLLBACK;\n"+
   " };\n"+
    "let b=insert into OPost set title=:title,"+
        "guid=:guid,author=:author ,"+
        "createdAt=sysdate('yyyy-MM-dd HH:mm:ss'),"+
        "updatedAt=:pubdate,"+
        "description=:description,"+
        "image=:image,"+
        "link=:link,"+
        "pubDate	=:pubDate,"+
        "summary=:summary;\n"+
    "let c=create EDGE OPublish from :mediaId to $b;\n"+
    "commit retry 5;"+
    "return $b;";

    post["mediaId"]=media.rid;
    return{"sql":sql,params:post};
}




function  fetchFeeds(feed) {
   return new Promise((resolve,reject)=>{
        FeedParser.parseUrl(feed.url,timeOutSecs,(e,result)=>{
            if(e){
                reject(e)
            }else{
                resolve(result)
            }
        })
    })
}

function errorResponse(reason,code,content) {
    return [{"errors":[{"reason":reason,"code":code,"content":content}]}]

}

function successResponse(data) {
    return [{"result":[data]}];

}

app.listen(port, () => console.log(`app listening on port ${port}!`))