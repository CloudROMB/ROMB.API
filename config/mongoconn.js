const mongoClient = require('mongodb').MongoClient;
const colors = require('colors'); // does not alter string prototype
const config = require('./config');
let connDBStr = config.DB.provider + '://';
let DB = {};

module.exports.getNewCode = async (collectionName) => {
  try {
    const code = await DB.db.command({
      findAndModify: "_codes",
      query: {
        name: collectionName
      },
      update: {
        $inc: {code: 1}
      },
      upsert: true,
      new: true
    });

    if (code && code.ok) {
      return code.value
    } else {
      return false
    }
  } catch (err) {
    console.log('ERROR getNewCode:', err);
    return false
  }
};

async function testConnection() {
  try {
    if (DB && DB.db) {
      console.log('PING:', new Date());
      const ping = await DB.db.command({ping: 1});
      if (ping && ping.ok) {
        console.log('PING OK', new Date());
        return true;
      }

      console.log('DB PING ERROR:');
      connectDB();
      return false;
    } else {
      console.log('DB IS DOWN');
      connectDB();
      return false;
    }
  } catch (err) {
    console.log('ERROR PING:', err);
    return false;
  }
}

setInterval(testConnection, 30000);

function connectDB() {
  console.log('Connecting to ' + config.DB.host + ':' + config.DB.port);
  // return mongoClient.connect(connDBStr)
  const constr = 'mongodb://' + config.DB.username + ':' + encodeURIComponent(config.DB.password) + '@' + config.DB.connStr;
  // console.log('---', constr);
  return mongoClient.connect(constr)
    .then((client) => {
      const db = client.db(config.DB.db);
      // console.log(client);
      console.log(colors.bgWhite.green('Connected to DB ' + db.databaseName));
      return new Promise(function (resolve, reject) {
        DB.client = client;
        DB.db = db;
        DB.docs = db.collection(config.DB.docs);
        DB.types = db.collection(config.DB.systemTypes);
        DB.metadata = db.collection(config.DB.metadata);
        DB.users = db.collection(config.DB.usersCollection);
        DB.customers = db.collection("customers");
        DB.mail = db.collection("mail");
        DB.partners = db.collection("partners");
        DB.files = db.collection("files");

        // module.exports.getNewCode('test');
        // module.exports.getNewCode('codes')
        //   .then(code => {
        //     console.log('codes', code);
        //   });

        resolve(DB)
      });
    })
    .catch((err) => {
      console.log(encodeURIComponent(config.DB.connStr));
      console.log(err.message);
      return new Promise(function (resolve, reject) {
        reject(err)
      });
    });
}

module.exports.connect = connectDB;

module.exports.addFile = (file) => {
  if (!file || typeof file !== 'object' || !DB.files) {
    console.log('no DB connection established');
    res.status(401).json({
      result: false,
      message: "no DB connection established"
    });
  } else {
    // console.log(DB.files);
    try {
      return DB.files.insertOne(file)
        .then(doc => {
          return new Promise(function (resolve, reject) {
            resolve(doc)
          });
        })
        .catch(err => {
          return new Promise(function (resolve, reject) {
            reject(err)
          });
        });
    }
    catch (err) {
      console.log('INSERT FILE:', err.message);
      return new Promise(function (resolve, reject) {
        reject(err)
      });
    }
  }
};

try {
  if (config.DB.username) {
    connDBStr += encodeURIComponent(config.DB.username);
    if (config.DB.password) {
      connDBStr += ':' + encodeURIComponent(config.DB.password);
    }
    connDBStr += '@';
  }
  connDBStr += config.DB.host;
  if (config.DB.port) {
    connDBStr += ':' + config.DB.port;
  }
  if (config.DB.db) {
    connDBStr += '/' + encodeURIComponent(config.DB.db);
  }
}
catch (e) {
  console.log('DB Error: ' + e.message);
  process.exit(1);
}
