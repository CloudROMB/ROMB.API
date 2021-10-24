const express = require('express');
const router = express.Router();
// const cors = require('cors');
const jwt = require('jsonwebtoken');
const colors = require('colors/safe'); // does not alter string prototype
const config = require('../config/config');
const tokens = require('../lib/tokens');
const cors = require('../lib/cors');
const api = require('../lib/api');

if (!module.parent) {
  process.exit(1);
}


// const corsOptionsDelegate = function (req, callback) {
//   let corsOptions;
//   currentOrigin = undefined;
//   console.log('ORIGIN', req.header('Origin'));
//   if (req.header('Origin') && whitelist.indexOf(req.header('Origin')) !== -1) {
//     console.log('GOOD ORIGIN', whitelist.indexOf(req.header('Origin')));
//     corsOptions = {origin: true} // reflect (enable) the requested origin in the CORS response
//     currentOrigin = req.header('Origin');
//   } else {
//     console.log('BAD ORIGIN');
//     corsOptions = {origin: false} // disable CORS for this request
//   }
//   callback(null, corsOptions) // callback expects two parameters: error and options
// };

// user account info
// router.options('*', cors(corsOptionsDelegate), function (req, res, next) {
//   if (typeof currentOrigin === 'undefined') {
//     res.sendStatus(400);
//   } else {
//     res.sendStatus(204);
//   }
// });

// router.use(cors(corsOptions), function (req, res, next) {
//   console.log(req.hostname);
//   // res.json(module.exports.origin);
//   res.json({msg: 'This is CORS-enabled for a whitelisted domain.'});
// });
// router.use(cors(corsOptions), function (req, res, next) {
//   try {
//     console.log('CORS', req.originalUrl);
//     cors(corsOptions);
//     console.log('GOOD CORS', req.originalUrl);
//     console.log('ORIGIN2', currentOrigin);
//
//     next();
//     return;
//   } catch (e) {
//     res.json(JSON.stringify(e));
//   }
//   // res.json({msg: 'This is CORS-enabled for a whitelisted domain.'});
//   console.log('WRONG CORS', req.originalUrl);
//   // res.json(module.exports.origin);
//   next();
// });

/* GET users listing. */
router.get('/', (req, res, next) => {
// Note: cache should not be re-used by repeated calls to JSON.stringify.
  let cache = [];
  let DB = JSON.stringify(req.app.get('db'), function (key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        // Circular reference found, discard key
        return;
      }
      // Store value in our collection
      cache.push(value);
    }
    return value;
  });
  // console.log(req.app.get('db'));
  res.status(405).json({
    result: false,
    // db: DB,
    message: "no method was provided"
  });
  cache = null; // Enable garbage collection
});


tokens.noGetMethod(router);
cors.checkCORS(router);
cors.setCORSHeaders(router);

async function getCredentials(roles, collection) {
  const out = [];
  if (!(roles && roles instanceof Array && roles.length)) {
    return out;
  }

  const activeroles = await collection.find({
    active: true,
    deleted: {$ne: true}
  }).toArray();

  activeroles.forEach(all => {
    // console.log('all roles:', all.code);
    roles.forEach(one => {
      // console.log('one roles:', one.code);
      if (String(all._id) === one.id) {
        out.push(all.code);
      }
    })
  });

  return out;
}

// USER LOGIN
router.post('/login', async (req, res, next) => {
  try {
    const login = req.body.login;
    const password = req.body.password;
    const db = req.app.get('db');

    if (!login) return res.json({
      result: false,
      status: 401,
      message: "no user name was provided"
    });

    if (!password) return res.json({
      result: false,
      status: 401,
      message: "no password was provided"
    });

    const users = await api.hasCollectionAsync('users', db);
    if (!users || !users.result) return res.json(users);

    const roles = await api.hasCollectionAsync('roles', db);
    if (!roles || !roles.result) return res.json(users);

    const user = await users.collection.findOne({
      login: login.toLowerCase(),
      deleted: {$ne: true}
    });
    console.log('user: ', user);
    if (!user) return res.json({
      result: false,
      status: 401,
      message: "user not exists"
    });
    if (!user.active) return res.json({
      result: false,
      status: 403,
      message: "user not activated"
    });

    const credentials = await getCredentials(user.roles, roles.collection);
    console.log('user credentials:', credentials);
    if (!credentials || !credentials.length) {
      return res.json({
        result: false,
        status: 403,
        message: "wrong credentials"
      });
    }
    if (!tokens.comparePassword(password, user.passHash)) {
      return res.json({
        result: false,
        status: 403,
        message: "wrong password"
      });
    }

    // console.log('DB user', user);
    tokens.signToken(user, (err, token) => {
      if (err) {
        console.log('SIGN ERROR', err);
        return res.json({
          result: false,
          message: err.message,
          status: 501
        })
      }

      // удаляем секретные данные
      delete user._id;
      delete user.passHash;
      delete user.password;

      /**
       * @param {{nameObject:object}} user
       */
      return res.json({
        result: true,
        token: token,
        user: {
          login: user.login,
          name: user.name,
          credentials: credentials
        }
      });
    });
  } catch (err) {
    console.log('ERROR', err);
    return res.json({
      result: false,
      status: 501,
      message: err.message
    });
  }
});

// регистрация пользователя
router.post('/register', async (req, res, next) => {
  try {
    const name = req.body.name;
    const login = req.body.login;
    const password = req.body.password;
    const email = req.body.email;
    const db = req.app.get('db');

    // console.log(req.body);
    if (!name) return res.status(403).json({
      result: false,
      message: "Не указано ФИО пользователя"
    });

    if (!login) return res.status(403).json({
      result: false,
      message: "Не указан логин пользователя"
    });

    if (!password) return res.status(403).json({
      result: false,
      message: "Не указан пароль"
    });

    if (!email || !/.+@.+\..+/.test(email.trim())) {
      return res.status(403).json({
        result: false,
        message: "Не верный адрес электронной почты"
      });
    }

    let users = await api.hasCollectionAsync('users', db);
    // console.log('answer: ', answer);
    if (!users.result) {
      if (!users.status) users.status = 405;
      return res.json(users);
    }

    let user = await users.collection.findOne({
      login: login.toLowerCase(),
      deleted: {$ne: true}
    });
    if (user) {
      return res.json({
        result: false,
        status: 409,
        message: "Пользователь с таким именем уже существует."
      });
    }

    const hash = await tokens.hashPassword(password);
    // console.log('HASH PASS:', hash);
    if (!hash) return res.status(403).json({
      result: false,
      status: 520,
      message: 'Плохой пароль'
    });

    // получаем бесправную роль
    const roles = [];
    // console.log('db:', db);
    const rolescoll = await api.hasCollectionAsync('roles', db);
    if (rolescoll && rolescoll.result) {
      const role = await api.getDocumentByCodeAsync(rolescoll.collection, 'unactivated');
      if (role && role.result) {
        roles.push(role.data);
      } else {
        console.log('ERROR role:', role);
      }
    }

    // указали email?
    // let email = req.body.email;
    // if (email && typeof email === 'string') {
    //   email = email.trim();
    // } else {
    //   email = null;
    // }

    const code = await api.getNewCode(db, users.collectionName);
    if (!code) {
      return res.json({
        result: false,
        status: 405,
        message: 'bad new collection code'
      });
    }

    // удача! пишем пользователя в базу
    user = await users.collection.insertOne({
      code: code,
      name: name,
      login: login.toLowerCase(),
      // password: encodeURI(req.body.password),
      passHash: hash,
      active: false,
      roles: roles,
      email: email
    });

    if (!user) {
      return res.status(409).json({
        result: false,
        message: "Не удалось зарегистрировать пользователя"
      });
    }

    // удача! возвращаем ОК
    // console.log(user);
    res.status(201).json({
      result: true,
      message: `User <${login}> registered`
    });
    // TODO требуется уведомление о регистрации нового пользователя
  } catch (err) {
    console.log('ERROR register user:', err);
    return res.json({
      result: false,
      status: 520,
      message: err.message
    });
  }
});


// !!! NEXT METHODS CHECK THE AUTH
router.use(tokens.verifyToken, (req, res, next) => {
  // console.log(colors.cyan('authData:\n'), tokens.authData);
  next();
});

// user account info
router.post('/info', async function (req, res, next) {
  try {
    const db = req.app.get('db');
    const users = db.collection('users');
    const answer = await api.getDocumentByIDAsync(users, req.authData.id);
    if (answer && !(answer.result && answer.data)) {
      if (!answer.status) answer.status = 405;
    } else {
      delete answer.data._id;
      delete answer.data.password;
      delete answer.data.passHash;
    }

    return res.json(answer);
  }
  catch (err) {
    return res.json({
      result: false,
      message: err.message,
      status: 520
    });
  }
});

router.post('/tokeninfo', function (req, res, next) {
  if (req.authData) {
    res.json({
      result: true,
      user: req.authData
    })
  } else {
    res.status(501).json({
      result: false,
      message: 'the token is broken'
    })
  }
});

module.exports = router;
