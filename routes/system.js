const express = require('express');
const router = express.Router();
const cors = require('../lib/cors');
const tokens = require('../lib/tokens');

if (!module.parent) {
  process.exit(1);
}

cors.checkCORS(router);

/* GET users listing. */
router.get('*', (req, res, next) => {
  res.status(405).json({
    result: false,
    message: "no method was provided"
  });
});

cors.setCORSHeaders(router);

// !!! NEXT METHODS CHECK THE AUTH
router.use(tokens.verifyToken, (req, res, next) => {
  next();
});

// list of customers
router.post('/types/list', function (req, res, next) {
  console.log('oj');
  let iterator = 0;
  const Types = req.app.get('SystemTypes');
    if (!Types) res.status(401).json({
      result: false,
      message: "no DB connection established"
    });
    else {
      try {
        Types.find({
          deleted: {$ne: true}
        })
          .sort({"_id": 1})
          .map((item) => {
            iterator++;
            item.num = iterator;
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
