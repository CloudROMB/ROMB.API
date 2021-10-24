const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config/config');

// const upload = multer({dest: '../www/attachments/'});
const attachDir = config.environment.upload_dir;
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // console.log('file1', file, attachDir);
    cb(null, attachDir);
  },
  filename: function (req, file, cb) {
    const hash = crypto.createHash('md5').update(file.originalname + Date.now().toString()).digest('hex');
    try {
      console.log('file2', file, attachDir);
      const fileTarget = {
        fieldname: file.fieldname,
        fileName: file.originalname,
        contentType: file.mimetype,
        generatedFileName: hash + path.extname(file.originalname),
        length: 0,
        stamp: new Date().toISOString()
      };
      // console.log('upload:', fileTarget);
      // console.log('new file:', fileTarget);
      cb(null, fileTarget.generatedFileName)
    } catch (e) {
      console.log('MULTER ERROR:', e);
      cb(e, null)
    }
  },
  limits: {
    fileSize: config.environment.MAX_UPLOAD_SIZE,
    files: config.environment.MAX_UPLOAD_FILES_COUNT
  },
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  }
});
const upload = multer({storage: storage});

function checkFileType(file, cb) {
  const fileTypes = /jpeg|jpg|png|gif|tif|tiff|pdf|xls|xlsx|doc|docx/;
  const mimeTypes = /jpeg|jpg|png|gif|tif|tiff|pdf|xls|xlsx|doc|docx|word|excel|officedocument/;

  const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = mimeTypes.test(file.mimetype);

  if (extName && mimeType) {
    return cb(null, true)
  } else {
    return cb('wrong file type!');
  }
}

module.exports = upload;
