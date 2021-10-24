const express = require('express');
const router = express.Router();
const upload = require('../lib/uploads');

const cors = require('../lib/cors');
const DB = require('../config/mongoconn');
const sendMail = require('../lib/sendmail');
const api = require('../lib/api');

const tokens = require('../lib/tokens');

router.post('/creditOrder',
  upload.fields([
    {name: 'file'},
    {name: 'file1'},
    {name: 'file2'},
    {name: 'file3'},
    {name: 'file4'},
    {name: 'file5'},
    {name: 'file6'},
    {name: 'file7'},
    {name: 'file8'},
    {name: 'file9'},
    {name: 'file10'},
    {name: 'file11'},
    {name: 'file12'}
  ]), (req, res, next) => {

    const result = {
      result: true
    };

    try {
      if (!req.body || typeof req.body !== 'object' || !Object.keys(req.body).length) {
        return res.json({
          result: false,
          message: 'there is no body'
        });
      }

      console.log('files: ', req.files, req.files instanceof Array);
      if (req.files) {
        let files = [];

        for (let item in req.files) {
          console.log('items...', item);
          if (req.files[item] instanceof Array) {
            req.files[item].map(file => {
              const fileTarget = {
                fileName: file.originalname,
                contentType: file.mimetype,
                generatedFileName: file.filename,
                length: file.size,
                created: new Date().toISOString()
              };
              console.log('ADDING FILE:', fileTarget);
              files.push(fileTarget);
              DB.addFile(fileTarget);

              return fileTarget
            })
          }
        }

        result.files = files;
      }

      result.doc = {
        contractDate: new Date().toISOString(),
        partner: req.body.orderPartner,
        customer: req.body.orderFIO,
        creditSumm: req.body.orderSumm,
        feeSumm: req.body.orderFee,
        comment: req.body.orderComments,
        order: {
          goods: req.body.orderGoods,
          period: req.body.orderPeriod,
          summ: req.body.orderSumm,
          initialFee: req.body.orderFee,
          tel: req.body.orderTel,
          PDN: req.body.orderAgreement
        },
        files: result.files
      };

      const Docs = req.app.get('Docs');
      api.addDocument(Docs, result.doc, answer => {
        console.log('ADD DOC:', answer);
        if (answer.result) {
          const orderForMail = {
            partner: req.body.orderPartner || '',
            fio: req.body.orderFIO || '',
            tel: req.body.orderTel || '',
            creditType: req.body.orderCreditType || '',
            summ: req.body.orderSumm || '',
            period: req.body.orderPeriod || '',
            initialFee: req.body.orderFee || '',
            goods: req.body.orderGoods || '',
            comments: req.body.orderComments || '',
            PDN: req.body.orderAgreement || ''
          };
          sendMail.sendCreditOrder(orderForMail, result.files, (answer) => {
            result.email = answer;
            // res.json(result);

            res.redirect(301, 'http://www.ru/page-333.html');
          });
        } else {
          console.log('ERROR', answer.message);
          res.redirect(301, 'http://www.ru/page-333.html');
        }
      });
    } catch (err) {
      console.log('ERROR ORDER: ', err);

      // res.json({
      //   result: false,
      //   message: err.message,
      //   error: JSON.stringify(err)
      // });

      res.redirect(501, 'http://www.ru/page-333.html');
    }
  });


cors.checkCORS(router);
cors.setCORSHeaders(router);

// current version
router.get('/ver', async (req, res, next) => {
  const db = req.app.get('db');
  const answer = await api.getConstant(db, 'versionCRM');
  return res.json(answer);
});

router.post('/ver', async (req, res, next) => {
  const db = req.app.get('db');
  let d = new Date();
  const utc = d.getTime() - (d.getTimezoneOffset() * 60000);
  d = new Date(utc + (3600000 * 0)); // Moscow GMT+03 if server time is GMT+03
  // d = new Date(utc + (3600000 * 3)); // Moscow GMT+03 if server time is GMT+00
  const ver = d.getFullYear() + '.' + (d.getMonth() + 1) + '/' + d.getDate() + '-' + d.getUTCHours();
  const answer = await api.setConstant(db, 'versionCRM', ver);
  console.log('VERSION:', d, ver);
  return res.json(answer);
});

// tokens.noGetMethod(router);

module.exports = router;
