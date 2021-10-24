const express = require('express');
const router = express.Router();
const cors = require('../lib/cors');
const tokens = require('../lib/tokens');
const api = require('../lib/api');
const metadata = require('../lib/metadata');
const conf = require('../config/config');

const upload = require('../lib/uploads');
const DB = require('../config/mongoconn');

tokens.noGetMethod(router);
cors.checkCORS(router);
cors.setCORSHeaders(router);

// !!! NEXT METHOD CHECK THE AUTH
router.use(tokens.verifyToken, (req, res, next) => {
  next();
});

// get table list
router.post('/list', async function (req, res, next) {
  try {
    if (!req.body.params || !req.body.collection) {
      return res.json({
        result: false,
        status: 405,
        message: 'wrong parameters'
      });
    }

    const coll = await api.getCollectionAsync(req.app, req.body.collection);
    if (!coll || !coll.result) {
      return res.json(coll);
    } else {
      answer = await api.listAsync(coll, req.body.params, req.body.criteria, coll.metadata.fields);
      if (!answer || !answer.result) answer.status = 405;
      return res.json(answer);
    }
  } catch (err) {
    console.log('ERROR /list'.underline.red, err);
    return res.json({
      result: false,
      message: err.message,
      err: JSON.stringify(err),
      status: 520
    });
  }
});

router.post('/reflist', async function (req, res, next) {
  try {
    if (!req.body.params || !req.body.collection) {
      return res.json({
        result: false,
        status: 405,
        message: 'wrong parameters'
      });
    }
    const coll = await api.hasCollectionAsync(req.body.collection, req.app.get('db'));
    if (!coll || !coll.result) {
      return res.json(coll);
    } else {
      const answer = await api.refListAsync(coll, req.body.params);
      if (!answer || !answer.result) answer.status = 405;
      return res.json(answer);
    }
  } catch (err) {
    return res.json({
      result: false,
      message: err.message,
      err: JSON.stringify(err),
      status: 520
    });
  }
});

// get table list
router.post('/meta', async function (req, res, next) {
  try {
    const answer = await metadata.getMeta(req.app,
      {
        metaName: req.body.collection,
        kind: req.body.kind
      });
    if (!answer.result && !answer.status) answer.status = 405;
    return res.json(answer);
  } catch (err) {
    console.log('ERROR /meta'.underline.red, err.message);
    return res.json({
      result: false,
      message: err.message,
      err: JSON.stringify(err),
      status: 520
    });
  }
});

// get document
router.post('/document/get', async function (req, res, next) {
  try {
    if (!req.body.collection) {
      return res.json({
        result: false,
        status: 405,
        message: 'wrong parameters'
      });
    }

    let answer = await api.hasCollectionAsync(req.body.collection, req.app.get('db'));
    if (!answer || !answer.result) {
      return res.json(answer);
    } else {
      if (req.body.id) {
        answer = await api.getDocumentByIDAsync(answer.collection, req.body.id);
      } else if (req.body.code) {
        answer = await api.getDocumentByCodeAsync(answer.collection, req.body.code);
      } else if (req.body.name) {
        answer = await api.getDocumentByNameAsync(answer.collection, req.body.name);
      } else {
        return res.json({
          result: false,
          message: 'wrong method',
          status: 405
        });
      }

      if (!answer.result && !answer.status) answer.status = 405;
      return res.json(answer);
    }
  }
  catch (err) {
    return res.json({
      result: false,
      message: err.message,
      status: 520
    });
  }
});

// add document
router.post('/document/add', async function (req, res, next) {
  try {
    if (!req.body.collection || !req.body.data || typeof req.body.data !== 'object') {
      return res.json({
        result: false,
        status: 405,
        message: 'wrong parameters'
      });
    }

    const db = req.app.get('db');
    let coll = await api.hasCollectionAsync(req.body.collection, db);
    if (!coll || !coll.result) {
      return res.json(coll);
    } else {
      let doc = req.body.data;

      // new code
      if (!(doc.code && typeof doc.code === 'string' && doc.code.length <= conf.DBCollections.maxNameLength)) {
        const code = await api.getNewCode(db, coll.collectionName);
        if (!code) {
          return res.json({
            result: false,
            status: 405,
            message: 'bad new collection code'
          });
        }
        doc.code = code;
      }

      // get user
      const user = await tokens.getUserByToken(req);
      // console.log('USER:', user);
      if (!user) {
        return res.json({
          result: false,
          status: 401,
          message: 'forbidden. bad user token'
        });
      }
      // console.log('USER ID:', user.id);

      doc = api.addRequiredPutProps(doc, user, true);
      delete doc._id;

      console.log('ADDING doc:'.bgYellow.black, doc);
      answer = await api.addDocumentAsync(coll.collection, doc);
      if (!answer.result && !answer.status) answer.status = 405;

      return res.json(answer);
    }
  }
  catch (err) {
    return res.json({
      result: false,
      message: err.message,
      err: JSON.stringify(err),
      status: 520
    });
  }
});

// update document
router.post('/document/put', async function (req, res, next) {
  try {
    if (!req.body.collection || !req.body.data || typeof req.body.data !== 'object') {
      return res.json({
        result: false,
        status: 405,
        message: 'wrong parameters'
      });
    }

    const db = req.app.get('db');
    let answer = await api.hasCollectionAsync(req.body.collection, db);
    if (!answer || !answer.result) {
      return res.json(answer);
    }

    let doc = req.body.data;
    if (!doc.code) {
      const code = await api.getNewCode(db, answer.collectionName);
      // console.log('NEW CODE:', code);
      if (!code) {
        return res.json({
          result: false,
          status: 405,
          message: 'bad update collection code'
        });
      }
      doc.code = code;
    }

    // get user
    const user = await tokens.getUserByToken(req);
    // console.log('USER:', user);
    if (!user) {
      return res.json({
        result: false,
        status: 401,
        message: 'forbidden. bad user token'
      });
    }
    // console.log('USER ID:', user.id);

    doc = api.addRequiredPutProps(doc, user, false);
    console.log('PUT:', doc);

    // console.log('PUT doc:', doc);
    answer = await api.updateDocumentAsync(answer.collection, doc);
    if (!answer.result && !answer.status) answer.status = 405;

    return res.json(answer);
  }
  catch (err) {
    return res.json({
      result: false,
      message: err.message,
      err: JSON.stringify(err),
      status: 520
    });
  }
});

// delete document
router.post('/document/delete', async function (req, res, next) {
  try {
    if (!(req.body.collection && typeof req.body.collection === 'string' && req.body.id && typeof req.body.id === 'string')) {
      return res.json({
        result: false,
        status: 405,
        message: 'wrong parameters'
      });
    }

    const db = req.app.get('db');
    const coll = await api.hasCollectionAsync(req.body.collection, db);
    if (!coll || !coll.result) {
      return res.json(coll);
    } else {
      const answer = await api.deleteDocumentAsync(db, coll, req.body.id, req.body.undelete);
      if (!answer.result && !answer.status) answer.status = 405;
      return res.json(answer);
    }
  }
  catch (err) {
    return res.json({
      result: false,
      message: err.message,
      err: JSON.stringify(err),
      status: 520
    });
  }
});

// list of customers
router.post('/docslist', function (req, res, next) {
  const Docs = req.app.get('Docs');
  api.list(Docs, req.body, {}, {}, (answer) => {
    if (answer.result === false) res.status(405);

    res.json(answer);
  });
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
      });
      return;
    }
    result.data = JSON.stringify(req.body);
    res.json(result);
  });

router.post('/uploadFiles', upload.any(), async (req, res, next) => {
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
        // DB.addFile(fileTarget);

        return fileTarget
      });

      return res.json({
        result: true,
        files: files
      });
    } else {
      return res.json({
        result: false,
        message: 'there are no files'
      });
    }
  } catch (e) {
    console.log('ERROR /uploadfiles', e);
    return res.json({
      result: false,
      message: err.message
    });
  }
});


// TO-DOs
router.post('/todolist', function (req, res, next) {
  const Coll = req.app.get('db').collection('todo');

  api.list(Coll, req.body, null, null, (answer) => {
    if (answer.result === false) res.status(405);

    res.json(answer);
  });
});

router.post('/deltodo', function (req, res, next) {
  const Coll = req.app.get('db').collection('todo');

  api.deleteDocument(Coll, req.body.id, (answer) => {
    if (answer.result === false) res.status(405);

    res.json(answer);
  });
});

router.post('/puttodo', function (req, res, next) {
  const Coll = req.app.get('db').collection('todo');

  api.updateDocument(Coll, req.body, (answer) => {
    if (answer.result === false) res.status(405);

    res.json(answer);
  });
});

router.post('/addtodo', function (req, res, next) {
  const Coll = req.app.get('db').collection('todo');
  if (!Coll) {
    res.status(401).json({
      result: false,
      message: "no DB connection established"
    });
    return;
  }
  if (!req.body || !req.body.name) {
    res.status(401).json({
      result: false,
      message: "no body"
    });
    return;
  }

  try {
    // if (req.body.hasOwnProperty('_id')) {
    //   delete req.body['_id'];
    // }
    doc = req.body;

    api.addDocument(Coll, req.body, (answer) => {
      res.json(answer);
      if (answer.result) {
        res.status(200).json(answer);
      } else {
        res.status(405).json(answer);
      }
    });
  } catch (e) {
    console.log('SYS ERROR:', e.message);
    res.json({
      result: true,
      message: e.message,
      error: JSON.stringify(e)
    });
  }
});

module.exports = router;
