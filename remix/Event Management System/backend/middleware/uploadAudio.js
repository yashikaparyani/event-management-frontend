// middleware/uploadAudio.js
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');


// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/audio/');
   },//Purpose: This Multer configuration specifies the exact subdirectory within the uploads folder where audio files specifically should be stored. It tells Multer: "When you receive an audio file, put it into a folder named audio inside the uploads folder."
   
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept audio files only
  if (file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});


module.exports = upload;
