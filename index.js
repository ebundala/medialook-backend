/**
 * Created by ebundala on 1/4/2019.
 */
const Express =require('express');
//const Parser =require('rss-parser');
const RssDiscover=require('rss-finder');
const FeedParser=require("davefeedread");
const validator = require('validator');
const OrientDB = require('orientjs');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount/serviceAccount.json');

const SequentialTaskQueue=require('sequential-task-queue').SequentialTaskQueue;
const striptags = require('striptags');
const app = Express();
const port = 3000;
const timeOutSecs = 30;
const mediaQueue = new SequentialTaskQueue();
const feedsQueue = new SequentialTaskQueue();
const postQueue = new SequentialTaskQueue();
let queue=[];

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://medialook.firebaseio.com"
});

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
    const categoriesSql="select from OCategory";
    req.db.query(categoriesSql).then((categories)=>{

    return req.db.query(sql).then((medias)=>{


        return {medias,categories}
    })
    }
    ).then((result)=>{
        queue.push(result);
        res.json(successResponse(result.medias.length));

    }).catch ((e)=>{
        console.error(e)
        res.json(errorResponse(e.code,e.code,e.message));
    }).finally(()=>{
        console.log("complete getting feeds from medias");
    });



});

app.get("/validate/media",(req,res)=>{
    let url=req.query.url;
    let feedUrls=req.query.feedUrls;
    let uid=req.query.uid;
    let sql="select *,in_OFollow.out[@rid=:uid].size() as followed from OMedia where feedUrls=:feedUrls OR url=:url";
    console.log(url,"\n",feedUrls,"\n",uid);
    req.db.query(sql,{params:{feedUrls:feedUrls,url:url,uid:uid}}).then((result)=>{
        res.json(successResponse(result));
    }).catch((e)=>{
        res.json(errorResponse(e.code,e.code,e.message));
    }).finally(()=>{
        console.log("complete validating ",url);
    })
});


app.post("/signup",(req,res)=>{
  
    if(!req.db){
        res.json(errorResponse(400,400,"failed to connect to database"))
    }

  let headers=req.headers
  if(headers.authorization){
       let authorization=headers.authorization.split(" ")[1];
       console.log(headers.authorization)
       admin.auth().verifyIdToken(authorization).then((claims)=>{
           console.log("claims....start.......\n",claims,"\n..........claims.....end\n")
        return admin.auth().getUser(claims.uid).then((userRecord) => {
            // The claims can be accessed on the user record.
            let customClaims=userRecord.customClaims;
            console.log("useridClaims ",customClaims?customClaims.rid:"")

           if(!(customClaims&&customClaims.rid))
           {
               let sql=`INSERT INTO user SET 
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
               
               let names=[];
               if(userRecord.displayName){
                 names=userRecord.displayName.split(" ")
               }
               if(!(names.length>0)){
                let emailSubstr=userRecord.email.split("@")
                names.push(emailSubstr[0])
               }      
               let params={
                "name":userRecord.email,//names.length>0?names[0]:"",
                "password":userRecord.uid,
                "uid":userRecord.uid,
                "email":userRecord.email,
                "firstName":names.length>0?names[0]:"",
                "surName":names.length>1?names[1]:"",
                //"gender":userRecord.,
                //"dob":userRecord.d,
                //"country":country,
                "avator":userRecord.photoURL,
                "userRole":"admin",
                "status":"ACTIVE"
              }
              return req.db.query(sql,{params}).then((user)=>{
                let recordId=user[0]["@rid"];
                  console.log("new user rid ",user,"\n",recordId)
                  let rid=recordId.cluster+":"+recordId.position;

               
               return admin.auth().setCustomUserClaims(userRecord.uid,{rid:rid})
                .then(()=>{
                        res.json(successResponse({"uid":userRecord.uid,"rid":rid}))
                })
              })
           }
           else{
            res.json(successResponse({"uid":claims.uid,"rid":customClaims.rid}))
           }
        });
       }).catch((e)=>{
           console.error(e)
        res.json(errorResponse(e.code,e.code,e.message))
    })
       
  }
  else{
      res.json(errorResponse(401,401,"unauthorized"))
  }
    
})

function createUserWithToken(claims,db){
    if(claims){

    }
}





function processRefresh(result){
    console.log(result.medias.length,result.categories.length);
    result.medias.map((media,i,all)=>{
        mediaQueue.push(()=>{
            console.log("process media ",i)
            media.feedUrls=media.feedUrls;
            media.feedUrls.map((feed,i,_feeds)=>{
                feedsQueue.push(()=>{
                    console.log("feching feed ",i);
                    fetchFeeds(feed).then((feedContent)=>{
                        feedContent.items.map((post,i,posts)=>{
                            postQueue.push(()=>{
                                const categories=result.categories;
                                savePostToDB(post,media,categories);

                            })
                        })

                    });



                })

            })
        });
    });

}

function savePostToDB(post,media,categories) {

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


    let query=buildQuery(post,media,categories);
   return db.query(query.sql,
        {   class: 's',
            params:query.params
        }).then((res)=>{
        console.log(res[0].title);
    }).catch((e)=>{
       console.error(e.message)
   })

}
function findCategories(post,categories){
    return categories.filter((x) => {
     return post.categories.find((t,i,arr)=>{
            let pattern=new RegExp(x.categoryName,"gi");
           // console.log("testing",t);
            return t.toString().match(pattern);
        });

    });

}
function buildQuery(post,media,categories){
    let category=findCategories(post,categories);
    if(category.length==0){
        post.categories.push("Breaking news");
        category=findCategories(post,categories);
    }

    let categorySql;
    let categoryEdges= category.map((t,i,arr)=>{
       // console.log("rid is ",t["@rid"]);
        let recordId=t["@rid"];
        let rid=recordId.cluster+":"+recordId.position;
       return "let c"+1+"=create EDGE OBelong from $b to "+rid+";";
    });

     categorySql=categoryEdges.join("\n");

    console.log("categories found",category);
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
        "enclosures=:enclosures,"+
        "image=:image,"+
        "link=:link,"+
        "pubDate	=:pubDate,"+
        "summary=:summary;\n"+
    "let c=create EDGE OPublish from :mediaId to $b;\n"+
        categorySql+
    "commit retry 5;"+
    "return $b;";

    post["mediaId"]=media.rid;
	if(post.summary){
	post.summary=striptags(post.summary);
	}
    if(post.image){
        post.image=JSON.stringify(post.image);
    }
	if(post.description){
	post.description=striptags(post.description);
	}
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