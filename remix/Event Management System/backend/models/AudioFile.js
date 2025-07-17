const mongoose = require('mongoose');

const audioFileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true,
    unique: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },

  duration: {
    type: Number, // in seconds
    required: true
  },

  mimeType: {
    type: String,
    required: true
  },
  
  format: {
    type: String,
    required: true // mp3, wav, flac, etc.
  },
  sampleRate: {
    type: Number,
    default: 44100
  },
  bitRate: {
    type: Number
  },
  channels: {
    type: Number,
    default: 2 // stereo
  },
  waveformData: {
    type: String // JSON string containing waveform peaks data
  },
  metadata: {
    title: { type: String },
  },
  isProcessed: {
    type: Boolean,
    default: false
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'error'],
    default: 'pending'
  },
  editHistory: [{
    operation: {
      type: String,
      enum: [
        'upload', 'cut', 'copy', 'paste', 'trim', 'split', 'merge', 
        'concatenate', 'volume_adjust', 'fade_in', 'fade_out', 
        'silence_region', 'reverse', 'insert'
      ]
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed
    },
    resultFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AudioFile'
    },
  //   previousState: {
  //   duration: Number,
  //   fileSize: Number
  // } //added functionality can be deleted anytime. 
  }],
  parentFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AudioFile' // For tracking file lineage after edits
  },
  isOriginal: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String
  }],
  isPublic: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
audioFileSchema.index({ userId: 1, createdAt: -1 });
audioFileSchema.index({ projectId: 1 });
audioFileSchema.index({ fileName: 1 });
audioFileSchema.index({ processingStatus: 1 });

// Virtual for getting file URL
audioFileSchema.virtual('fileUrl').get(function() {
  return `/uploads/audio/${this.fileName}`;
});

// Method to add edit operation to history
audioFileSchema.methods.addEditOperation = function(operation, parameters, resultFileId) {
  this.editHistory.push({
    operation,
    parameters,
    resultFileId,
    timestamp: new Date()
  });
  return this.save();
};

// Static method to find files by user and project
audioFileSchema.statics.findByUserAndProject = function(userId, projectId) {
  const query = { userId };
  if (projectId) {
    query.projectId = projectId;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// ----------------------------------------------------------------

// ----------------------------------------------------

module.exports = mongoose.model('AudioFile', audioFileSchema);