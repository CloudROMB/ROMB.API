const express = require('express');
const path = require('path');
const colors = require('colors/safe'); // does not alter string prototype
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const api = require('./routes/api');
const ext = require('./routes/ext');
const exmpls = require('./routes/examples');
const system = require('./routes/system');
const index = require('./routes/index');
const users = require('./routes/users');
const customers = require('./routes/customers');
const mail = require('./routes/mail');
const config = require('./config/config');

const app = express();


// app.use(function (req, res, next) {
//   try {
//     console.log('METHOD:'.bgBlue.yellow, req.method);
//     console.log('PROTOCOL:'.bgBlue.yellow, req.protocol);
//     console.log('HOST:'.bgBlue.yellow, req.headers.host);
//     console.log('BODY:'.bgBlue.yellow, req.body);
//
//     // if (req.protocol === 'http' && req.headers.host === 'api.pozvony.online') {
//     //   res.redirect('https://' + req.headers.host +req.url);
//     // } else {
//     //   next();
//     // }
//     console.log('protocol:'.bgRed.white, req.protocol);
//     next();
//     // if (req.protocol === 'http') {
//     //   console.log('REDIRECT TO SSL:'.bgRed.white);
//     //   res.redirect('https://' + req.headers.host + req.url);
//     // } else {
//     //   next();
//     // }
//   } catch (err) {
//     console.log('ERROR:', err);
//     next(err);
//   }
// });

require('./config/mongoconn').connect()
  .then(res => {
    app.set('dbClient', res.client);
    app.set('db', res.db);
    app.set('Docs', res.docs);
    app.set('SystemTypes', res.types);
    app.set('Users', res.users);
    app.set('Customers', res.customers);
    app.set('Mail', res.mail);
    app.set('Files', res.files);
    app.set('Partners', res.partners);
  })
  .catch(err => {
    console.log('Can not connect to DB: ' + err.message);
    process.exit(1);
  });

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(favicon(path.join(__dirname, 'public', '/images/logo.png')));
app.use(logger('dev'));

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: false, limit: '50mb'}));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../data/')));

// debug middleware
app.use((req, res, next) => {
  console.log('URL:', colors.yellow(req.protocol + '://' + req.headers.host + req.originalUrl));
  console.log('Method: ', colors.red(req.method));
  // console.log('Headers: ', colors.green(JSON.stringify(req.headers)));
  console.log('Body: ', colors.cyan(JSON.stringify(req.body)));
  // console.log('req', req);
  next();
});

app.use('/', index);
app.use('/api', api);
app.use('/ext', ext);
app.use('/users', users);
app.use('/customers', customers);
app.use('/system', system);
app.use('/example', exmpls);
app.use('/mail', mail);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  // res.status(err.status || 500);
  res.status(204);
  console.log('!!! SERVER ERROR:', err);
  // console.log('!!! SERVER ERROR:', err);
  // res.json(JSON.stringify(err));
  try {
    if (req.method === 'GET') res.render('error', {
      message: err.message,
      error: JSON.stringify(err),
      title: 'ERROR'
    });
    else res.json({
      result: false,
      message: err.message,
      error: JSON.stringify(err)
    });
  } catch (e) {
    console.log('!!+ SERVER ERROR:', e);
    res.json({
      result: false,
      message: e.message
    });
  }
});

module.exports = app;
