const countries = require("./countries.json").features;
const OrientDB=require("orientjs");
const ServerConfig=require("./config").ServerConfig;
const Server=OrientDB({...ServerConfig,host:"localhost"});


const insertCountries=async ()=>{
let sqls=[];
let promises=[]
const db = Server.use({
    name: 'medialook',
    username: 'medialook',
    password: 'medialook'
});
countries.forEach((element) => {
    let {ADMIN,ISO_A3}=element.properties;
    let {geometry}=element
    if(ADMIN&&ISO_A3&&geometry&&geometry.type&&geometry.coordinates){
        console.log(ADMIN,ISO_A3,geometry.type)
    let query=buildQuery(ADMIN,ISO_A3,geometry);
   // sqls.push(query);
    promises.push(db.query(query))

    }
    //db.query(query)
    //element.properties
});
return await Promise.all(promises)
}


const buildQuery=(name,iso3,geometry)=>{
    return `CREATE VERTEX OCountry set countryName="${name}",flag="https://www.countryflags.io/${iso3}/flat/64.png",
      iso3="${iso3}",createdAt=sysdate('yyyy-MM-dd HH:mm:ss'),
      geometry={"@class":"O${geometry.type}","coordinates":[${geometry.coordinates.toString()}]}`;
}

insertCountries().then((res)=>{
    console.log(res);
    process.exit(0)
}).catch((e)=>{
    console.error(e)
    process.exit(1)
});
