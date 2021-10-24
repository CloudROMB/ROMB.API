const express = require('express');
const router = express.Router();
const cors = require('../lib/cors');
const tokens = require('../lib/tokens');

const upload = require('../lib/uploads');
const api = require('../lib/api');
const DB = require('../config/mongoconn');

tokens.noGetMethod(router);
cors.checkCORS(router);
cors.setCORSHeaders(router);

// !!! NEXT METHOD CHECK THE AUTH
router.use(tokens.verifyToken, (req, res, next) => {
  next();
});

// list of customers
router.post('/list', function (req, res, next) {
  const Mail = req.app.get('Mail');
  try {
    api.list(Mail, req.body,
      {box: 'inbox'},
      {
        _id: 1,
        box: 1,
        id: 1,
        'body.subject': 1,
        'body.inReplyTo': 1,
        'body.from': 1,
        'body.to': 1,
        'body.date': 1,
        'body.receivedDate': 1,
        'body.html': 0
      }, (answer) => {
        if (answer.result === false) res.status(405);

        if (answer.data && answer.data.length) {
          // TO-DO сделать универсальный метод вывода данных списка
          answer.data = answer.data.map(mail => {
            return {
              _id: mail._id,
              subject: mail.body.subject,
              ReplyTo: mail.body.ReplyTo,
              from: mail.body.from,
              to: mail.body.to,
              receivedDate: mail.receivedDate,
              attachments: mail.attachments
            }
          });
        }

        res.json(answer);
      });
  } catch (e) {
    console.log('SYS ERROR:', e.message);
    res.json({
      result: true,
      message: JSON.stringify(e.message)
    });
  }
  // }
});

router.post('/creditOrder',
  upload.fields([{name: 'file1'}, {name: 'file2'}]),
  (req, res, next) => {
    const result = {
      result: true
    };
    try {
      // console.log('files: ', req.files, req.files instanceof Array);
      if (req.files && req.files instanceof Array) {
        const files = req.files.map(file => {
          const fileTarget = {
            fileName: file.originalname,
            contentType: file.mimetype,
            generatedFileName: file.filename,
            length: file.size,
            created: new Date().toISOString()
          };
          // console.log('FILE:', fileTarget);
          DB.addFile(fileTarget);

          return fileTarget
        });
        result.files = files;
      }
    } catch (e) {
      res.json({
        result: false,
        message: err.message,
        error: JSON.stringify(err)
      })
      return;
    }
    result.data = JSON.stringify(req.body);
    res.json(result);
  });

module.exports = router;
