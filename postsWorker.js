/**
 * Created by ebundala on 1/9/2019.
 */
const { timeOutSecs, ServerConfig, RabbitMqSettings, PostQueue } = require('./config');
const OrientDB = require('orientjs');
const striptags = require('striptags');
const {replaceHtml}=require("./utils");

const Server = OrientDB(ServerConfig);

const amqplib = require('amqplib');



const postsConsumerTask = (timeout = timeOutSecs) => {
    let db;
    return new Promise((resolve, reject) => {
        try {
            const open = amqplib.connect(RabbitMqSettings);
            db = Server.use({
                name: 'medialook',
                username: 'medialook',
                password: 'medialook'
            });
            resolve(open)
        }
        catch (e) {
            reject(e)
        }
    }).then((conn) => {
        return conn.createChannel();
    }).then(async (ch) => {
        return ch.assertQueue(PostQueue).then((ok) => {
            return ch.consume(PostQueue, (msg) => {
                if (msg !== null) {
                    let str = msg.content.toString()
                    let msgObj = JSON.parse(str);
                    let query = buildQuery(msgObj);
                    return savePostToDB(query, db).then((_) => {
                        ch.ack(msg);
                    }).catch((_) => {
                        ch.nack(msg);
                    })

                }
            });
        });
    }).catch((e) => {
        console.error(e);
        console.debug("wait for next retry in ", timeout / 2, " s")
        setTimeout(() => {
            postsConsumerTask((2 * timeout));
        }, timeout)
    });
}

function savePostToDB(query, db) {
    return db.query(query.sql,
        {
            class: 's',
            params: query.params
        }).then(([res]) => {
            console.debug("saved ", res.title);
        }).catch((e) => {
            console.error(e.message)
        })

}


function getCategories() {
    const categoriesSql = "select from OCategory";
    const db = Server.use({
        name: 'medialook',
        username: 'medialook',
        password: 'medialook'
    });
    return db.query(categoriesSql);
}



function buildQuery({post,feedUrl}) {
    let pubDate = "";

    if (post.pubDate) {
        pubDate = post.pubDate.toString().replace("T", " ").toString();

    }
    else if (post.date) {
        pubDate = post.date.toString().replace("T", " ").toString();

    }
    console.warn("\n...............\ndate format " + pubDate + "\n "+post.pubDate+"\n........................\n")



    let sql = "begin;\n" +
        "let a=select from OPost where ";

    if (post.guid) {
        sql = sql + "guid=':guid'";
    }
    else {
        sql = sql + "link=':link'";
    }
    let media=`(select from OMedia where feedUrl='${feedUrl}')`;
    sql = sql + ";\n" +
        "if($a.size()>0){\n" +
        "ROLLBACK;\n" +
        " };\n" +
        "let b = insert into OPost set title=:title," +
        "guid=:guid,author=:author," +
        "createdAt=sysdate('yyyy-MM-dd HH:mm:ss')," +
        `updatedAt="${pubDate}",` +
        "description=:description," +
        "enclosures=:enclosures," +
        "image=:image," +
        "link=:link," +
        `pubDate="${pubDate}",` +
        "summary=:summary;\n" +
        `let c = create EDGE OPublish from ${media} to $b;\n` +
        //  categorySql +
        "commit retry 1;" +
        "return $b;";
        //console.debug(post.enclosures);
   if((post.enclosures instanceof Array&&!post.enclosures.length)
   ||!post.enclosures){

      console.debug("post has no image\n "+post.guid+"\n retrying to get from content")
       let content=post.summary+post.description;
       let imageRegex=new RegExp(/(?<=<img(.*)src=["'])(.+?)(?=["'](.*)>)/igm)
       let videoRegex=new RegExp(/(?<=<source(.*)src=["'])(.+?)(?=["'](.*)>)/igm)
       let images=content.toString().match(imageRegex)
       let videos=content.toString().match(videoRegex)
       
       
       if(!post.enclosures){
           post.enclosures=[];
       }
       if(images){
         post.enclosures.push(...images.map((item)=>{
               return{
                "type":"image",
                "url":item,
              // "width":null,
              // "height":null
            };
           }).filter((item)=>item.url&&item.type));
       }  
       if(videos){
        post.enclosures.push(...videos.map((item)=>{
              return{
               "type":"video",
              "url":item,
             // "width":null,
            //  "height":null
           }
          }).filter((item)=>item.url&&item.type));
      }    
      console.debug("images found ");
      console.debug(post.enclosures); 
     // if(!post.enclosures.length)
     // post.enclosures=null;
    }



    if (post.title) {
        post.title = replaceHtml( striptags(post.title));
    }
    if (post.summary) {
        post.summary = replaceHtml( striptags(post.summary));
    }
    if (post.image) {
        post.image = JSON.stringify(post.image);
    }
    /*if (post.enclosures) {
        post.enclosures = JSON.stringify(post.enclosures);
    }*/
    if (post.description) {
        post.description = replaceHtml( striptags(post.description));
    }
    return { "sql": sql, params: post };
}






//run main task

postsConsumerTask();





