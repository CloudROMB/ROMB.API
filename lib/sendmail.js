const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const path = require('path');
const config = require('../config/config');

const templateOptions = {
  viewEngine: {
    extname: '.hbs',
    layoutsDir: 'views/email/',
    defaultLayout: 'orderemail',
    partialsDir: 'views/partials/'
  },
  viewPath: 'views/email/',
  extName: '.hbs'
};
const replyTo = {
  name: '',
  address: 'mail@www.ru'
};
const subscribe = {
  url: 'http://www.ru/subscribed/',
  comment: 'Подписаться на уведомления'
};
const unsubscribe = {
  url: 'http://www.ru/unsubscribe/',
  comment: 'Отписаться от рассылки навсегда'
};
const toOrderAdresses = [
  {
    name: 'www',
    address: 'mail@www.ru'
  }
];
const toTempOrderAdresses = [
  {
    name: 'Pax Beach',
    address: 'paxbeach@gmail.com'
  },
  {
    name: 'Pax Beach',
    address: 'paxbeach@yandex.ru'
  }
];

try {
  const mailer = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true, // true for 465, false for other ports 587
    auth: {
      user: 'noreply@www.ru',
      pass: '112233445566778899000'
    }
  });
  mailer.use('compile', hbs(templateOptions));
  console.log('Mailer OK');
} catch (e) {
  console.log('Mailer error:', e);
  process.exit(1);
}

module.exports.sendCreditOrder = (order, attach, next) => {
  // console.log('order:', order);
  // console.log('attach:', attach);
  const mailer = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true, // true for 465, false for other ports 587
    auth: {
      user: 'noreply@www.ru',
      pass: '112233445566778899000'
    }
  });
  mailer.use('compile', hbs(templateOptions));
  // console.log('Mailer OK');

  if (!mailer) {
    console.log('Error: no mailer');

    next({
      sended: false,
      message: "has no transport"
    });
    // return {
    //   result: false,
    //   message: "has no transport"
    // };

    return;
  }
  // console.log(email);

  let orderMailOptions = {
    from: {
      name: 'WWW',
      address: 'noreply@www.ru'
    },
    replyTo: replyTo,
    to: toTempOrderAdresses,
    bcc: [],
    subject: 'Заявка', // Subject line
    text: 'Кредитная заявка', // plain text body
    template: 'orderemail',
    context: {
      tpl: order
    },
    list: {
      // List-Help: <mailto:admin@example.com?subject=help>
      help: replyTo.address + '?subject=help',
      // List-Unsubscribe: <http://example.com> (Comment)
      unsubscribe: unsubscribe,
      // List-Subscribe: <mailto:admin@example.com?subject=subscribe>
      // List-Subscribe: <http://example.com> (Subscribe)
      subscribe: [
        replyTo.address + '?subject=subscribe',
        subscribe
      ],
      // List-Post: <http://example.com/post>, <mailto:admin@example.com?subject=post> (Post)
      post: [
        [
          'http://www.ru/post',
          {
            url: replyTo.address + '?subject=post',
            comment: 'Post'
          }
        ]
      ]
    }
  };

  // console.log('orderMailOptions:', orderMailOptions);
  if (attach && attach instanceof Array && attach.length > 0) {
    // [ {
    // filename: 'text.bin',
    // contentType: 'text/plain',
    // path: '/path/to/file.txt'
    // }, ... ]
    // maping after multer
    orderMailOptions.attachments = attach.map(el => {
      console.log('attach: ', el.generatedFileName, typeof el.generatedFileName);
      const attachPath = config.environment.upload_dir;
      console.log('attachPath: ', attachPath, typeof attachPath);
      const filePath = path.join(attachPath, el.generatedFileName);
      return {
        filename: el.fileName,
        contentType: el.contentType,
        path: filePath
      }
    });
  }
  const email = replyTo.address;

  try {
    console.log('Try send', orderMailOptions);
    mailer.sendMail(orderMailOptions, (error, info) => {
      if (error) {
        console.log('ERROR: ' + email + ' - ' + error.message);

        next({
          sended: false,
          message: "Ошибка почты. Не удалось отправить Ваше сообщение. Попробуйте снова чуть позже.",
          info: info
        });
      } else {
        console.log('Message sent: %s', info.messageId);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      mailer.close();
      // console.log('mailer closed');

      // console.log('Message sent');
      //If Successful

      next({
        sended: true,
        message: "Ваше cообщение успешно отправлено",
        info: info
      });
    });
    // console.log('End of send');
  } catch (err) {
    console.log('ERROR MAIL SEND:', err);
    next({
      sended: false,
      message: err.message
    });
    // return {
    //   result: false,
    //   message: err.message
    // };
  }
};

