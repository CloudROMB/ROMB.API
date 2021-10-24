const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

module.exports.comparePassword = function (pass, hash) {
  try {
    return bcrypt.compareSync(pass, hash);
  } catch (err) {
    console.log(err.message);
    return false
  }
};

module.exports.signToken = function (user, cb) {
  jwt.sign(
    {
      id: user._id,
      login: user.login,
      name: user.name,
      nameObject: user.nameObject,
      stamp: new Date().toISOString()
    }, config.auth.secretKey, {expiresIn: '3h'}, cb);
};

module.exports.hashPassword = function (pass) {
  try {
    const salt = bcrypt.genSaltSync(11);
    return bcrypt.hashSync(pass, salt);
  } catch (err) {
    console.log('ERROR HASH PASS:', err);
    return null;
  }
};

module.exports.getUserByToken = function (req) {
  try {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'string') {
      console.log('bearerHeader !== string');
      return null;
    }

    const bearer = bearerHeader.split(' ');
    const token = bearer[1];

    return jwt.verify(token, config.auth.secretKey, (err, authData) => {
      if (err) {
        console.log('bearer error:', err.message);
        return null;
      }

      // console.log('AUTH DATA:', authData);
      return authData;
    });
  } catch (err) {
    console.log('ERROR getUserByToken:', err.message);
    return null;
  }
};

module.exports.verifyToken = function (req, res, next) {
  // if (req.method !== 'POST') {
  //   res.sendStatus(201);
  // }

  const bearerHeader = req.headers['authorization'];
  if (typeof bearerHeader === 'undefined') {
    //  forbidden
    console.log('bearerHeader === undefined');
    res.status(403).json({
      result: false,
      message: 'no authorization was provided'
    })
  } else {
    const bearer = bearerHeader.split(' ');
    req.token = bearer[1];
    // console.log('token', req.token);

    jwt.verify(bearer[1], config.auth.secretKey, (err, authData) => {
      if (err) {
        console.log('bearer error:', err.message);
        res.status(403).json({
          result: false,
          message: err.message
        })
      } else {
        req.authData = authData;
        module.exports.authData = authData;
        next()
      }
    });
  }
};

module.exports.noGetMethod = function (router) {
  /* GET users listing. */
  router.get('*', (req, res, next) => {
    res.render('standart', {message: 'no method was provided'});
    // res.status(405).json({
    //   result: false,
    //   message: "no method was provided"
    // });
  });
};
