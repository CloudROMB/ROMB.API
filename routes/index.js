const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {title: 'CRM.API v2.0 is ready for commands ...'});
});

module.exports = router;