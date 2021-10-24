const util = require('util');
const utils = require('./utils');
const tokens = require('../lib/tokens');
const metadata = require('../lib/metadata');
const colors = require('colors'); // does not alter string prototype
const wait = util.promisify(setTimeout);

const conf = require('../config/config');
const mongodb = require('mongodb');

function getFilterCriteria(criteria, par) {
  if (!criteria) {
    criteria = {};
  }
  if (par && par.trim()) {
    const filter = new RegExp(par.trim(), "i");
    criteria.$or = [
      {'author.name': filter},
      {'editor.name': filter},
      {'banks.name': filter},
      {'partner.name': filter},
      {'department.name': filter},
      {'customer.name': filter},
      {'address.name': filter},
      {'user.name': filter},
      {'from.name': filter},
      {'from.address': filter},
      {subject: filter},
      {descr: filter},
      {comment: filter},
      {code: filter},
      {name: filter},
      {login: filter}
    ];
  }
}

async function dbIsAliveAsyn(db) {
  try {
    if (!db) {
      console.log('ERROR dbIsAliveAsyn:'.underline.red, 'no db connection established');
      return {
        result: false,
        message: 'no db connection established'
      };
    }

    const dbAnsw = await db.command({ping: 1});
    if (!dbAnsw || !dbAnsw.ok) {
      console.log('ERROR dbIsAliveAsyn:'.underline.red, 'the DB is not alive');
      return {
        result: false,
        message: 'the DB is not alive'
      };
    } else {
      return {
        result: true
      };
    }
  } catch (err) {
    console.log('ERROR dbIsAliveAsyn:'.underline.red, err.message);
    return {
      result: false,
      message: "DB ERROR: " + err.message,
      status: 520
    }
  }
}

module.exports.dbIsAliveAsyn = dbIsAliveAsyn;

function prepareGetField(el) {
  if (el.type) {
    el.type = prepareFieldType(el.type);
  }

  if (el.name) {
    el.property = el.name;
    delete el.name;
  }

  if (!el.width) {
    el.width = 180;
  }

  return el;
}

module.exports.prepareGetField = prepareGetField;

function prepareFieldType(type) {
  let res = type;
  if (res.indexOf('[]') >= 0) {
    res = res.replace('[]', 'Array');
  }
  if (res.indexOf('{}') >= 0) {
    res = res.replace('{}', 'Object');
  }

  return res;
}

module.exports.getNewCode = async (db, collectionName) => {
  try {
    const code = await db.command({
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
      return code.value.code
    } else {
      return null
    }
  } catch (err) {
    console.log('ERROR getNewCode:', err);
    return null
  }
};

module.exports.hasCollectionAsync = async (collName, db) => {
  try {
    if (!collName || typeof collName !== 'string' || collName.length > conf.DBCollections.maxNameLength) {
      return {
        result: false,
        message: 'wrong collection name'
      };
    }

    const alive = await dbIsAliveAsyn(db);
    if (!alive.result) {
      return alive;
    }

    const coll = db.collection('_metadata');
    const doc = await coll.findOne({
      $or: [
        {code: collName},
        {dbName: collName},
        {name: collName}
      ],
      deleted: {$ne: true}
    });
    if (!doc || !doc.dbName) {
      return {
        result: false,
        message: `there is no meta-collection [${collName}]`
      };
    }

    // console.log('FIND COLL:', doc);
    // const colls = await db.getCollectionInfos({
    //   type: 'collection',
    //   name: doc.dbName
    // }).toArray();
    let colls = await db.listCollections({
      type: 'collection',
      name: doc.dbName
    }).toArray();
    // let colls = await db.listCollections(true, {
    //   name: doc.dbName
    // }).toArray();
    // console.log(colors.magenta('FIND COLL:'), colls);

    colls = colls.filter(el => {
      return (el.name === doc.dbName)
    });
    // console.log('FIND COLL:', colls);
    if (!colls || !colls.length || !colls[0].name) {
      return {
        result: false,
        message: "there is no DB collection " + collName
      };
    }

    return {
      result: true,
      code: doc.code,
      collectionName: doc.dbName,
      collection: db.collection(doc.dbName)
    };
  } catch (err) {
    console.log(colors.red('ERROR has collection:'), err);
    return {
      result: false,
      status: 520,
      message: 'ERROR has collection: ' + err.message
    };
  }
};

module.exports.getCollectionAsync = async (app, collName) => {
  try {
    if (!(app && app.get('db'))) {
      console.log('ERROR getCollectionAsync:'.underline.red, 'wrong metadata call. DB:', app.get('db'));
      return {
        result: false,
        message: 'wrong metadata call'
      };
    }

    if (!collName || typeof collName !== 'string' || collName.length > conf.DBCollections.maxNameLength) {
      return {
        result: false,
        message: 'wrong collection name'
      };
    }

    const db = app.get('db');
    const alive = await dbIsAliveAsyn(db);
    if (!alive.result) {
      return alive;
    }

    const meta = await metadata.getMeta(app, {
      metaName: collName,
      kind: 'list',
      clearFields: false
    });
    if (!meta.result) {
      if (!meta.status) meta.status = 405;
      return res.json(meta);
    }

    // const coll = db.collection('_metadata');
    // const doc = await coll.findOne({
    //   $or: [
    //     {code: collName},
    //     {dbName: collName},
    //     {name: collName}
    //   ],
    //   deleted: {$ne: true}
    // });
    // if (!doc || !doc.dbName) {
    //   return {
    //     result: false,
    //     message: `there is no meta-collection [${collName}]`
    //   };
    // }

    // console.log('FIND COLL:', doc);
    // const colls = await db.getCollectionInfos({
    //   type: 'collection',
    //   name: meta.data.dbName
    // }).toArray();
    let colls = await db.listCollections({
      type: 'collection',
      name: meta.data.dbName
    }).toArray();
    // console.log('list'.bgBlue.white, meta.data.dbName, colls);
    // let colls = await db.listCollections(true, {
    //   name: doc.dbName
    // }).toArray();
    // console.log(colors.magenta('FIND COLL:'), colls);

    colls = colls.filter(el => {
      return (el.name === meta.data.dbName)
    });
    // console.log('FIND COLL:', colls);
    if (!colls || !colls.length || !colls[0].name) {
      return {
        result: false,
        message: "there is no DB collection " + collName
      };
    }

    return {
      result: true,
      code: collName,
      collectionName: meta.data.dbName,
      collection: db.collection(meta.data.dbName),
      metadata: meta.data
    };
  } catch (err) {
    console.log(colors.red('ERROR has collection:'), err);
    return {
      result: false,
      status: 520,
      message: 'ERROR has collection: ' + err.message
    };
  }
};

module.exports.listAsync = async (coll, params, inCriteria, inView) => {
  try {
    if (!(coll && coll.collection)) {
      console.log('error "no DB connection established"');
      return {
        result: false,
        message: "no DB connection established"
      }
    }

    let par = (params && typeof params === 'object') ? params : {};

    let criteria = {};
    if (inCriteria && typeof inCriteria === 'object') {
      criteria = inCriteria
    } else if (par.criteria && typeof par.criteria === 'object') {
      criteria = par.criteria
    }
    console.log('criterias', inCriteria, criteria);

    let view = {};
    if (inView && typeof inView === 'object') {
      view = inView;
    }

    const sortAsc = (par.hasOwnProperty('sortAsc') && par.sortAsc === true) ? 1 : -1;

    let sortBy = {};
    if (par.hasOwnProperty('sortBy') && typeof par.sortBy === 'string') {
      sortBy[par.sortBy] = sortAsc;
    }
    sortBy._id = sortAsc;

    if (par.hasOwnProperty('deleted') && typeof par.deleted === 'boolean') {
      if (par.deleted === true) {
        criteria.deleted = true;
      } else {
        criteria.deleted = {$ne: true};
      }
    }

    // TO-DO поиск по ключевым словам надо расширить
    if (par.hasOwnProperty('filter') && typeof par.filter === 'string') {
      getFilterCriteria(criteria, par.filter);
    }

    // console.log('collName', coll.collectionName);
    console.log('criterias', criteria);
    const countAnswer = await coll.collection.aggregate(
      [
        {
          "$project": view
        },
        {
          "$match": criteria
        },
        {
          "$count": "cnt"
        }
      ],
      {
        "allowDiskUse": false
      }
    ).toArray();

    // console.log('records count:', countAnswer);
    // console.log('cursor:', await cursor.toArray());
    // let doc = await cursor.next();
    const recordsCount = (countAnswer.length > 0) ? countAnswer[0].cnt : 0;
    console.log('records count:', recordsCount);
    // let doc = await cursor.next();
    // if (doc) result.count = doc.cnt;
    // console.log('count:', doc);

    // Use `next()` and `await` to exhaust the cursor
    // for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    //   console.log('aggregate:', doc);
    //   result.count = doc.cnt;
    // }
    // result.count = r.cnt;
    // console.log('result.count', r);

    // result.count = await coll.find(criteria).count();

    const ofset = par.offset || 0;
    const limit = Math.min(par.limit || conf.lists.recordsOnPage, conf.lists.maxRecordsOnPage);

    // console.log('par', par, criteria, view);
    // console.log('sortBy', sortBy);
    // console.log('par.sortBy', par.sortBy || 'stamp');
    // console.log('par.offset', ofset);
    // console.log('limit', limit);

    // const data = await coll.find(criteria, view)
    // // .sort(par.sortBy || 'stamp', sortAsc)
    //   .sort(sortBy)
    //   .skip(par.offset || 0)
    //   .limit(Math.min(par.limit || conf.lists.recordsOnPage, conf.lists.maxRecordsOnPage))
    //   .toArray();

    const request = [
      {
        "$project": view
      },
      {
        "$match": criteria
      },
      {
        "$sort": sortBy
      },
      {
        "$skip": ofset
      },
      {
        "$limit": limit
      }
    ];
    // console.log('REQUEST:'.bgWhite.blue, request);

    const data = await coll.collection.aggregate(request, {"allowDiskUse": false}).toArray();
    // console.log('LIST:'.bgWhite.green, Object.keys(data).length);

    return {
      result: true,
      count: recordsCount,
      data: data
    }
  } catch (err) {
    console.log('SYS ERROR:'.bgRed.white, err.message);
    return {
      result: false,
      status: 520,
      message: err.message
    }
  }
};

module.exports.refListAsync = async (coll, params) => {
  if (!(coll && coll.collection)) {
    console.log('error "no DB connection established"');
    return {
      result: false,
      message: "no DB connection established"
    }
  }

  let par = (!params || typeof params !== 'object') ? {} : params;

  let criteria = {};

  try {
    // список справочника сортируем по возрастанию
    const sortAsc = (par.hasOwnProperty('sortAsc') && par.sortAsc === false) ? -1 : 1;

    let sortBy = {};
    if (par.hasOwnProperty('sortBy') && typeof par.sortBy === 'string') {
      sortBy[par.sortBy] = sortAsc;
    }
    sortBy.name = sortAsc;
    sortBy.code = sortAsc;
    sortBy._id = sortAsc;

    if (par.hasOwnProperty('deleted') && typeof par.deleted === 'boolean') {
      if (par.deleted === true) {
        criteria.deleted = true;
      } else {
        criteria.deleted = {$ne: true};
      }
    } else {
      criteria.deleted = {$ne: true};
    }

    if (par.hasOwnProperty('active') && typeof par.active === 'boolean') {
      if (par.active === true) {
        criteria.active = true;
      } else {
        criteria.active = {$ne: true};
      }
    }

    // TO-DO поиск по ключевым словам надо расширить
    if (par.hasOwnProperty('filter') && typeof par.filter === 'string') {
      getFilterCriteria(criteria, par.filter);
    }

    const ofset = par.offset || 0;
    const limit = Math.min(par.limit || conf.lists.maxRecordsInRefList, conf.lists.maxRecordsInRefList);
    // console.log('par', par, criteria);
    // console.log('sortBy', sortBy);
    // console.log('par.sortBy', par.sortBy || 'stamp');
    // console.log('par.offset', ofset);
    // console.log('limit', limit);

    let data = await coll.collection.aggregate(
      [
        {
          "$match": criteria
        },
        {
          "$sort": sortBy
        },
        {
          "$skip": ofset
        },
        {
          "$limit": limit
        }
      ],
      {
        "allowDiskUse": false
      }
    ).toArray();
    data = data.map(el => {
      let out = {};
      out.code = el.code;
      out.name = el.name;
      out.id = el._id;
      out.source = coll.code;

      console.log(out);
      return out;
    });
    // console.log('RES:', cursor);

    return {
      result: true,
      data: data
    }
  } catch (err) {
    console.log('SYS ERROR:'.bgRed.white, err.message);
    return {
      result: false,
      status: 520,
      message: err.message
    }
  }
};

module.exports.list = (coll, params, inCriteria, inView, next) => {
  let result = {
    result: false
  };

  if (!coll) {
    console.log('error "no DB connection established"');
    result.message = "no DB connection established";
    next(result);
  }

  let par = (!params || typeof params !== 'object') ? {} : params;

  let sortAsc = -1;

  let criteria = {};
  if (inCriteria && typeof inCriteria === 'object') {
    criteria = inCriteria
  }

  let view = {};
  if (inView && typeof inView === 'object') {
    view = inView;
  }

  try {
    const sortAsc = (par.hasOwnProperty('sortAsc') && par.sortAsc === true) ? 1 : -1;

    let sortBy = {};
    if (par.hasOwnProperty('sortBy') && typeof par.sortBy === 'string') {
      sortBy[par.sortBy] = sortAsc;
    }
    sortBy._id = sortAsc;

    if (par.hasOwnProperty('deleted') && typeof par.deleted === 'boolean') {
      if (par.deleted === true) {
        criteria.deleted = true;
      } else {
        criteria.deleted = {$ne: true};
      }
    }

    // TO-DO поиск по ключевым словам надо расширить
    if (par.hasOwnProperty('filter') && typeof par.filter === 'string') {
      getFilterCriteria(criteria, par.filter);
    }

    coll.find(criteria).count()
      .then(num => {
        result.count = num;
      })
      .catch(err => {
        result.message = err.message;
        result.error = err;
        next(result);
      });

    console.log('5', par, criteria, view);
    console.log('50', sortBy);
    console.log('51', par.sortBy || 'stamp');
    console.log('52', par.offset || 0);
    console.log('53', Math.min(par.limit || conf.lists.recordsOnPage, conf.lists.maxRecordsOnPage));
    coll.find(criteria, view)
    // .sort(par.sortBy || 'stamp', sortAsc)
      .sort(sortBy)
      .skip(par.offset || 0)
      .limit(Math.min(par.limit || conf.lists.recordsOnPage, conf.lists.maxRecordsOnPage))
      .toArray()
      .then((data) => {
        console.log('6', data);
        result.result = true;
        result.data = data;

        console.log('7');
        if (!result.hasOwnProperty('count')) {
          let int_ = setInterval(() => {
            if (result.hasOwnProperty('count')) {
              clearInterval(int_);
              next(result)
            }
          }, 100);
        } else next(result);
      })
      .catch(err => {
        console.log('DB ERROR:', err.message);
        result.message = err.message;
        result.error = err;
        next(result);
      });
  } catch (err) {
    console.log('SYS ERROR:', err.message);
    result.message = err.message;
    result.error = err;
    next(result);
  }
};

module.exports.addRequiredPutProps = (doc, user, newDoc) => {
  // fill stamp and author anyway
  if (!doc.stamp) doc.stamp = new Date();
  if (!doc.author) doc.author = {
    id: user.id,
    name: user.name,
    source: 'users'
  };

  // update document
  if (!newDoc) {
    doc.changed = new Date();
    doc.editor = {
      id: user.id,
      name: user.name,
      source: 'users'
    }
  }

  // set new password
  if (doc.password) {
    doc.passHash = tokens.hashPassword(doc.password);
    delete doc.password;
  }

  const dateFormat = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
  Object.keys(doc).forEach((key) => {
    if (typeof doc[key] === 'string') {
      if (dateFormat.test(doc[key])) {
        doc[key] = new Date(doc[key]);
      }
    }
  });

  return doc;
};

module.exports.addDocumentAsync = async (coll, doc) => {
  if (!coll) {
    return {
      result: false,
      message: 'DB connection error'
    };
  }

  try {
    if (!doc || typeof doc !== 'object') {
      if (!Object.keys(doc).length) {
        return {
          result: false,
          message: 'the doc is empty, nothing to add.'
        };
      }
    }

    const docSize = utils.roughSizeOfObject(doc);
    if (docSize > conf.environment.MAX_DOC_SIZE_BYTES) {
      return {
        result: false,
        message: `too much document size: ${docSize}`
      };
    }

    // coll.insertOne(doc)
    const answer = await coll.insert(doc);
    if (!answer) {
      return {
        result: false,
        message: 'unsuccess'
      }
    } else return {
      result: true,
      data: answer
    };
  } catch (err) {
    return {
      result: false,
      message: err.message,
      status: 520
    }
  }
};

module.exports.getDocumentByIDAsync = async (coll, id) => {
  if (!coll) {
    return {
      result: false,
      message: 'DB connection error'
    };
  }

  if (!id || typeof id !== 'string') {
    return {
      result: false,
      message: 'wrong ID'
    };
  }

  try {
    // coll.insertOne(doc)
    const doc = await coll.findOne({"_id": new mongodb.ObjectID(id)});
    if (!doc) {
      return {
        result: false,
        message: 'document not found'
      }
    } else return {
      result: true,
      data: doc
    };
  } catch (err) {
    return {
      result: false,
      message: err.message,
      status: 520
    }
  }
};

module.exports.getDocumentByNameAsync = async (coll, name) => {
  if (!coll) {
    return {
      result: false,
      message: 'DB connection error'
    };
  }

  if (!name || typeof name !== 'string') {
    return {
      result: false,
      message: 'wrong name'
    };
  }

  try {
    // coll.insertOne(doc)
    const doc = await coll.findOne({name: name});
    if (!doc) {
      return {
        result: false,
        message: 'document not found'
      }
    } else return {
      result: true,
      data: doc
    };
  } catch (err) {
    return {
      result: false,
      message: err.message,
      status: 520
    }
  }
};

module.exports.getDocumentByCodeAsync = async (coll, code) => {
  if (!coll) {
    return {
      result: false,
      message: 'DB connection error'
    };
  }

  if (!code || typeof code !== 'string') {
    return {
      result: false,
      message: 'wrong code'
    };
  }

  try {
    // coll.insertOne(doc)
    const doc = await coll.findOne({
      code: code,
      deleted: {$ne: true}
    });
    if (!doc) {
      return {
        result: false,
        message: 'document not found'
      }
    } else return {
      result: true,
      data: doc
    };
  } catch (err) {
    return {
      result: false,
      message: err.message,
      status: 520
    }
  }
};

module.exports.updateDocument = (coll, doc, next) => {
  if (!coll) {
    next({
      result: false,
      data: doc,
      message: 'DB connection error'
    });
    return;
  }

  try {
    if (!doc._id || typeof doc._id !== 'string') {
      next({
        result: false,
        data: doc,
        message: 'wrong ID type'
      });
      return;
    }
    const id = doc._id;
    delete doc['_id'];

    if (!doc || typeof doc !== 'object' || !Object.keys(doc).length) {
      next({
        result: false,
        data: doc,
        message: 'the doc is empty, nothing to save.'
      });
      return;
    }

    // coll.insertOne(doc)
    coll.updateOne(
      {
        "_id": new mongodb.ObjectID(id)
      },
      {
        $set: doc
      }
    )
      .then(answer => {
        next({
          result: true,
          data: answer
        })
      })
      .catch(err => {
        next({
          result: false,
          message: err.message,
          data: doc,
          error: err
        })
      })
  } catch (err) {
    next({
      result: false,
      message: err.message,
      data: doc,
      error: err
    })
  }
};

module.exports.updateDocumentAsync = async (coll, doc) => {
  if (!coll) {
    return {
      result: false,
      status: 405,
      message: 'DB connection error'
    };
  }

  if (!doc || typeof doc !== 'object' || !Object.keys(doc).length) {
    return {
      result: false,
      status: 405,
      message: 'the doc is empty, nothing to update.'
    };
  }

  try {
    if (!doc._id || typeof doc._id !== 'string') {
      return {
        result: false,
        status: 405,
        message: 'wrong ID type'
      };
    }
    const id = doc._id;
    delete doc['_id'];

    if (!Object.keys(doc).length) {
      return {
        result: false,
        status: 405,
        message: 'the doc consists only of ID, nothing to save.'
      };
    }

    // coll.insertOne(doc)
    const updateRes = coll.updateOne(
      {
        "_id": new mongodb.ObjectID(id)
      },
      {
        $set: doc
      }
    );
    if (updateRes) {
      return {
        result: true,
        data: updateRes
      };
    } else {
      return {
        result: false,
        status: 405,
        message: 'unsuccessful'
      };
    }
  } catch (err) {
    return {
      result: false,
      status: 520,
      message: err.message,
      error: err
    };
  }
};

module.exports.deleteDocument = (coll, id, next) => {
  if (!coll) {
    next({
      result: false,
      message: 'DB connection error'
    });
    return;
  }

  if (!id || typeof id !== 'string') {
    next({
      result: false,
      message: 'wrong ID type'
    });
    return;
  }

  try {
    // coll.deleteOne(
    //   {"_id": new mongodb.ObjectID(id)}
    // )
    coll.updateOne(
      {
        "_id": new mongodb.ObjectID(id)
      },
      {
        $set: {
          deleted: true
        }
      }
    )
      .then(answer => {
        next({
          result: true,
          status: 200,
          data: answer
        })
      })
      .catch(err => {
        next({
          result: false,
          status: 406,
          message: err.message,
          error:
          err
        })
      })
  } catch (err) {
    next({
      result: false,
      status: 520,
      message: err.message,
      error: err
    })
  }
};

module.exports.deleteDocumentAsync = async (db, coll, id, undelete) => {
  if (!db || !(coll && typeof coll === 'object')) {
    return {
      result: false,
      message: 'DB connection error'
    };
  }

  if (!id || typeof id !== 'string') {
    return {
      result: false,
      message: 'wrong ID type'
    };
  }

  try {
    const answer = await coll.collection.updateOne(
      {
        "_id": new mongodb.ObjectID(id),
        "system": {$ne: true}
      },
      {
        $set: {
          deleted: !(undelete === true)
        }
      });
    // date.fromISO

    console.log('DELETE answer', answer.result);
    if (!answer || !answer.result.ok) {
      return {
        result: false,
        message: 'unsuccess'
      }
    } else {
      if (!answer.result.nModified) {
        return {
          result: false,
          message: 'Невозможно удалить системную запись'
        }
      } else {
        return {
          result: true,
          data: answer.result
        }
      }
    }
  } catch (err) {
    console.log('ERROR deleteDocumentAsync:', err.message);
    return {
      result: false,
      status: 520,
      message: err.message
    }
  }
};

// VERSIONS
module.exports.getConstant = async (db, name) => {
  if (!db || !name) {
    return {
      result: false,
      status: 405,
      message: 'bad parameters'
    }
  }

  try {
    const doc = await db.collection('constants').findOne({
      "name": name
    });

    return {
      result: true,
      status: (doc) ? 200 : 204,
      data: doc
    }

  } catch (err) {
    return {
      result: false,
      status: 520,
      message: err.message
    }
  }
};

module.exports.setConstant = async (db, name, value) => {
  if (!db || !name) {
    return {
      result: false,
      status: 405,
      message: 'bad parameters'
    }
  }

  try {
    const doc = await db.collection('constants').updateOne(
      {
        "name": name
      },
      {
        $set: {"value": value}
      },
      {
        upsert: true
      }
    );

    return {
      result: true,
      status: (doc) ? 200 : 204,
      data: doc
    }
  } catch (err) {
    return {
      result: false,
      status: 520,
      message: err.message
    }
  }
};

// USERS
module.exports.getUserByLogin = async (db, login) => {
  const alive = await dbIsAliveAsyn(db);
  if (!alive.result) {
    return alive;
  }

  if (!login || typeof login !== 'string') {
    return {
      result: false,
      status: 405,
      message: 'wrong login'
    };
  }

  try {
    const user = await db.collection('users').findOne({login: login});
    if (!user) {
      return {
        result: false,
        status: 405,
        message: 'user not found'
      }
    }

    delete user.passHash;
    delete user.password;
    return {
      result: true,
      data: user
    }
  } catch (err) {
    return {
      result: false,
      message: err.message,
      status: 520
    }
  }
};
