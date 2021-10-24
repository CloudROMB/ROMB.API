const colors = require('colors');
const api = require('../lib/api');
const conf = require('../config/config');

const metaKinds = ['list', 'card'];

function prepareMeta(doc, system, kind, clearSystemKeys = true) {
  // выдать метаданные для карточки документа
  let props = [];
  let orderCounter = 200.0;

  switch (kind) {
    case 'list':
      if (clearSystemKeys === true) {
        delete doc._id;
        delete doc.dbName;
        delete doc.stamp;
        delete doc.author;
        delete doc.editor;
        delete doc.changed;
        delete doc.deleted;
      }

      // if (system.props && system.props instanceof Array) {
      //   props = system.props.filter(el => {
      //     return true
      //     // return (el.listField === true)
      //   });
      // }
      if (system.props && system.props instanceof Array) {
        props = JSON.parse(JSON.stringify(system.props));
      }

      // if (doc.code === 'reestr' ) {
      //   console.log('system'.bgGreen.white, system.props.map(el => el.name));
      //   console.log('system'.bgYellow.red, system.props.map(el => el.name));
      //   console.log('props'.bgYellow.red, doc.props.map(el => el.name));
      // }
      if (doc.props && doc.props instanceof Array) {
        doc.props
          .forEach(el => {
            let found = false;
            // console.log('arr.length', arr.length);
            for (let i = 0; i < props.length; i++) {
              // console.log('arr.length', i, props[i]);
              if (props[i].name === el.name) {
                found = true;
                // console.log('!', props[i].name);
                Object.keys(el).forEach(key => {
                  // console.log('!', String(key).bgBlue.red, el[key]);
                  // console.log('props[i][key]', props[i][key], el[key]);

                  props[i][key] = el[key];
                });
                // ar[i]
              }
            }
            // if (!found && el.listField) props.push(el);
            if (!found) props.push(el);
          });
      }
      // if (doc.code === 'reestr' ) {
      //   console.log('props'.bgYellow.red, props.map(el => el.name));
      // }

      doc.fields = {};
      doc.props = props
        .filter(el => {
          // оставляем только колонки для вывода в списке
          return (el.listField === true)
        })
        .map(el => {
          if (!el.order) {
            orderCounter += 3;
            el.order = orderCounter;
          } else {
            el.order = Number(el.order);
          }

          el = api.prepareGetField(el);
          doc.fields[el.property] = 1;
          // console.log('FIELD'.bgWhite.red, el.property);

          return el;
        })
        .sort((a, b) => {
          return (a.order - b.order);
        });

      // if (!clearSystemKeys && doc.code === 'reestr' ) {
      //   console.log('META:'.bgBlue.white, doc.props);
      //   console.log('FIELDS:'.bgRed.white, doc.fields);
      // }

      return {
        result: true,
        data: doc
      };

    case 'document':
      if (clearSystemKeys === true) {
        delete doc._id;
        delete doc.dbName;
        delete doc.stamp;
        delete doc.author;
        delete doc.editor;
        delete doc.changed;
        delete doc.deleted;
      }

      if (system.props && system.props instanceof Array) {
        props = system.props.filter(el => {
          return (el.cardField !== false)
        });
      }

      if (doc.props && doc.props instanceof Array) {
        doc.props
          .filter(el => {
            return (el.cardField !== false)
          })
          .forEach(el => {
            let found = false;
            // console.log('arr.length', arr.length);
            for (let i = 0; i < props.length; i++) {
              // console.log('arr.length', i, props[i]);
              if (props[i].name === el.name) {
                console.log('!', props[i].name);
                Object.keys(el).forEach(key => {
                  // console.log('props[i][key]', props[i][key], el[key]);

                  props[i][key] = el[key];
                });
                // ar[i]
                found = true;
              }
            }
            if (!found && el.listField) props.push(el);
          });
      }

      doc.fields = {};
      doc.props = props
        .map(el => {
          let o = 0;
          if (!el.order) {
            orderCounter += 3;
            o = orderCounter;
          } else {
            o = Number(el.order);
          }
          el.order = o;

          el = api.prepareGetField(el);
          doc.fields[el.property] = 1;

          return el;
        })
        .sort((a, b) => {
          return (a.order - b.order);
        });

      return {
        result: true,
        data: doc
      };
  }

  return {
    result: false,
    message: 'wrong query kind'
  }
}

module.exports.getMeta = async (app, params) => {
  try {
    if (!(app && app.get('db') && params && typeof params === 'object')) {
      console.log('ERROR getMeta:'.underline.red, 'wrong metadata call');
      return {
        result: false,
        message: 'wrong metadata call'
      };
    }

    // cached metadata
    let meta = app.get('meta');

    // read timer for reread cached metadata
    let lastReadDB = app.get('lastReadMetaFromDB');
    // console.log(String(lastReadDB).bgWhite.green, Date.now() - lastReadDB);
    // if (lastReadDB && Date.now() - lastReadDB > conf.DBCollections.refresh_metadata_every_secs * 1000) {
    //   lastReadDB = new Date.now();
    // }

    if (!(meta && meta instanceof Array && meta.length > 0 &&
      lastReadDB && Date.now() - lastReadDB < conf.DBCollections.refresh_metadata_every_secs * 1000)) {
      console.log('get meta from DB'.bgWhite.blue);
      meta = await module.exports.getAllMeta(app);
    } else {
      console.log('get meta from cache'.bgWhite.blue, meta.length);
    }
    // try to get meta from cache
    if (!(meta && meta instanceof Array && meta.length > 0)) {
      return {
        result: false,
        message: 'there is no metadata',
      };
    }
    // update timer for reread cached metadata
    app.set('lastReadMetaFromDB', Date.now());

    const metaName = params.metaName;
    const kind = params.kind;
    // if (!(metaName && typeof metaName === 'string' && metaName.length <= conf.DBCollections.maxNameLength
    //     && kind && typeof kind === 'string') && metaKinds.includes(kind)) {
    if (!(
        metaKinds.includes(kind) &&
        (!metaName || (metaName && typeof metaName === 'string' && metaName.length <= conf.DBCollections.maxNameLength))
      )) {
      console.log('ERROR meta:'.underline.red, 'wrong parameters', params);
      return {
        result: false,
        message: 'wrong parameters',
        status: 405
      };
    }
    let system = null;
    meta.forEach(el => {
      if (el.code === 'system') {
        system = JSON.parse(JSON.stringify(el));
      }
    });
    if (!system) {
      return {
        result: false,
        message: 'there is no system meta'
      };
    }

    if (metaName) {
      let doc = null;
      meta.forEach(el => {
        if (el.code === metaName || el.name === metaName) {
          doc = JSON.parse(JSON.stringify(el));
          // console.log('doc'.bgWhite.green, Object.keys(doc).length);
        }
      });
      if (!doc) {
        return {
          result: false,
          message: 'there is no such meta'
        };
      }

      // return prepareMeta(doc, system, kind, (doc.code !== 'metadata'));
      return prepareMeta(doc, system, kind, (params.clearFields !== false));
    } else {
      const docs = JSON.parse(JSON.stringify(meta));
      docs.forEach(doc => {
        // if (doc.code === 'reestr' ) {
        //   console.log('doc'.bgYellow.red, doc);
        // }
        // prepareMeta(doc, system, kind, (doc.code !== 'metadata'));
        const res = prepareMeta(doc, system, kind, (params.clearFields === true));
        if (res && res.result) {
          doc = res.data;
        } else {
          return res;
        }
      });
      return {
        result: true,
        data: docs
      };
    }
  } catch (err) {
    console.log('ERROR get meta'.underline.red, err);
    return {
      result: false,
      message: err.message,
      status: 520
    }
  }
};

module.exports.getAllMeta = async (app) => {
  try {
    const db = app.get('db');

    const system = await db.collection('_metadata').findOne({
      code: 'system',
      deleted: {$ne: true}
    });
    if (!system) {
      return {
        result: false,
        message: 'there is no system meta'
      };
    }

    let docs = await db.collection('_metadata').find({
        deleted: {$ne: true}
      }
    ).toArray();
    if (!(docs && docs.length)) {
      return {
        result: false,
        message: 'there is no such meta'
      };
    }
    app.set('meta', docs);
    return docs;
  } catch (err) {
    console.log('ERROR get meta'.underline.red, err);
    return null
  }
};