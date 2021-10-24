const express = require('express');
const cors = require('cors');
const router = express.Router();
const colors = require('colors/safe'); // does not alter string prototype
const config = require('../config/config');
const tokens = require('../lib/tokens');

if (!module.parent) {
  process.exit(1);
}

const whitelist = [
  'http://localhost',
  'https://crm.www.ru'
];
let currentOrigin;
const corsOptions = {
  origin: function (origin, callback) {
    console.log('ORIGIN', origin);
    if (typeof origin !== 'undefined' && whitelist.indexOf(origin) !== -1) {
      currentOrigin = origin;
      console.log('ORIGIN 2', origin);
      callback(null, true)
    } else {
      // callback(null, true)
      callback(new Error('Not allowed by CORS'))
    }
  }
};

const corsOptionsAll = {
  origin: "https://crm.www.ru",
  methods: "GET,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 201
};

// debug middleware
router.use((req, res, next) => {
  console.log('URL: ', colors.yellow(req.originalUrl));
  console.log('Method: ', colors.red(req.method));
  console.log('Headers: ', colors.green(JSON.stringify(req.headers)));
  console.log('Body: ', colors.cyan(JSON.stringify(req.body)));
  // console.log('req', req);
  next();
});

const corsOptionsDelegate = function (req, callback) {
  let corsOptions;
  currentOrigin = undefined;
  console.log('ORIGIN', req.header('Origin'));
  if (req.header('Origin') && whitelist.indexOf(req.header('Origin')) !== -1) {
    console.log('GOOD ORIGIN', whitelist.indexOf(req.header('Origin')));
    corsOptions = {origin: true}; // reflect (enable) the requested origin in the CORS response
    currentOrigin = req.header('Origin');
  } else {
    console.log('BAD ORIGIN');
    corsOptions = {origin: false} // disable CORS for this request
  }
  callback(null, corsOptions) // callback expects two parameters: error and options
};

// user account info
router.options('*', cors(corsOptionsDelegate), function (req, res, next) {
  if (typeof currentOrigin === 'undefined') {
    res.sendStatus(400);
  } else {
    res.sendStatus(204);
  }
});

/* GET users listing. */
router.get('/', (req, res, next) => {
  // console.log(req.app.get('db'));
  res.status(405).json({
    result: false,
    // db: DB,
    message: "no method was provided"
  });
  cache = null; // Enable garbage collection
});

// make headers for auth and CORS
router.use((req, res, next) => {
  console.log(colors.yellow('SET HEADERS'));
  res.append('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Credentials, Authorization');
  // res.append('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Access-Control-Allow-Origin, Access-Control-Allow-Methods, Authorization');
  // res.append('Access-Control-Allow-Origin', 'https://crm.www.ru');
  // res.append('Access-Control-Allow-Origin', 'http://localhost');
  if (currentOrigin) {
    res.append('Access-Control-Allow-Origin', currentOrigin);
  } else {
    res.append('Access-Control-Allow-Origin', '*');
  }
  res.append('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.append('Access-Control-Allow-Credentials', 'true');
  res.append('Access-Control-Max-Age', '3600');
  res.append('Content-Type', 'application/json');
  next();
});

// !!! NEXT METHODS CHECK THE AUTH
router.use(tokens.verifyToken, (req, res, next) => {
  next();
});

// list of customers
router.post('/list', function (req, res, next) {
    let pageNumber = 0;
    if (req.body.page
      && typeof req.body.page === 'number'
      && req.body.page > 0) pageNumber = req.body.page;

    const Customers = req.app.get('Customers');
    if (!Customers) res.status(401).json({
      result: false,
      message: "no DB connection established"
    });
    else {
      try {
        const skipRecords = pageNumber * config.lists["recordsOnPage"];
        const showRecords = config.lists["recordsOnPage"];
        let iterator = 0;
        Customers.find({
          deleted: {$ne: true}
        })
          .sort({"fio": 1})
          .skip(skipRecords)
          .limit(showRecords)
          .map((item) => {
            iterator++;
            item.num = skipRecords + iterator;
            return item;
          })
          .toArray()
          .then((data) => {
            res.json({
              result: true,
              data: data
            });
          })
          .catch(err => {
            res.json({
              result: false,
              message: JSON.stringify(err)
            });
          });
      } catch (e) {
        res.json({
          result: true,
          message: JSON.stringify(e.message)
        });
      }
    }
  }
);

module.exports = router;
