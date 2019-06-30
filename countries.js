const countries = require("./custom.geo.json").features;
const OrientDB = require("orientjs");
const ServerConfig = require("./config").ServerConfig;
const Server = OrientDB({ ...ServerConfig, host: "localhost" });


const insertCountries = async () => {

    let promises = []
    const db = Server.use({
        name: 'medialook',
        username: 'medialook',
        password: 'medialook'
    });
    countries.forEach((element) => {
        let { geometry, properties } = element
        let { admin, name, iso_a3, iso_a2, abbrev, continent, subregion } = properties;

        if (admin && iso_a2 && iso_a3 && geometry && name && geometry.type && geometry.coordinates) {

            let query = buildQuery({ admin, name, iso_a2, iso_a3, abbrev, continent, subregion, geometry });
            console.log(name, iso_a2, iso_a3, admin, abbrev)
            // sqls.push(query);
            promises.push(db.query(query))

        }
        //db.query(query)
        //element.properties
    });
    return await Promise.all(promises)
}


const buildQuery = ({ admin, name, iso_a2, iso_a3, abbrev, continent, subregion, geometry }) => {
    return `CREATE VERTEX OCountry set countryName="${name}",
    abbrev="${abbrev}",continent="${continent}",subregion="${subregion}",admin="${admin}",
    flag="https://www.countryflags.io/${iso_a2}/flat/64.png",
      iso3="${iso_a3}",iso2="${iso_a2}",createdAt=sysdate('yyyy-MM-dd HH:mm:ss'),
      geometry={"@class":"O${geometry.type}","coordinates":${JSON.stringify(geometry.coordinates)}}`;
}

insertCountries().then((res) => {
    console.log(res);
    process.exit(0)
}).catch((e) => {
    console.error(e)
    process.exit(1)
});
