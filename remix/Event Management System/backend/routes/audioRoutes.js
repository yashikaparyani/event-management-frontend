const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioEditorController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadAudio'); // Used for initial upload, and we'll reuse its config for edited audio too.

// File Management Routes (Keep these as they are for initial file handling)
router.post('/upload',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  upload.array('audioFiles', 10),
  audioController.uploadAudioFiles
);

router.get('/files',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  audioController.getAudioFiles
);

router.get('/files/:id',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  audioController.getAudioFileById
);

router.get('/files/:id/stream',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  audioController.streamAudioFile
);

router.get('/download/:id',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  audioController.downloadAudioFile
);

router.delete('/files/:id',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  audioController.deleteAudioFile
);

// router.post('/apply-edits',
//   authenticate,
//   authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']), // Adjust roles as needed
//   audioController.applyAudioEdits // This is the new controller function
// );

// New or Modified Routes for Editing Workflow

// Route for applying a single edit operation (cut, paste, etc.) in-place
router.post('/apply-single-edit',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  audioController.applySingleEdit // New controller method
);

// Route for saving the final edited version as a new file
router.post('/save-final-version',
  authenticate,
  authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
  audioController.saveFinalEditedVersion // New controller method
);





module.exports = router;