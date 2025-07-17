const mongoose = require('mongoose');

const audioEditOperationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  operationType: {
    type: String,
    enum: [
      'cut', 'copy', 'paste', 'trim', 'split', 'merge', 'concatenate',
      'volume_adjust', 'fade_in', 'fade_out', 'silence', 'reverse',
      'insert', 'delete_region'
    ],
    required: true
  },
  targetAudioFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AudioFile',
    required: function() {
      return !['merge', 'concatenate'].includes(this.operationType);
  }
},
  operationData: {
    // For region-based operations
    startTime: { type: Number },
    endTime: { type: Number },
    
    // For volume operations
    volumeLevel: { type: Number },
    
    // For fade operations
    fadeDuration: { type: Number },
    
    // For merge/concatenate operations
    sourceAudioFileIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AudioFile'
    }],
    
    // For paste/insert operations
    insertPosition: { type: Number },
    sourceRegion: {
      audioFileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AudioFile'
      },
      startTime: { type: Number },
      endTime: { type: Number }
    },
    
    // For split operations
    splitPositions: [{ type: Number }]
  },
  isApplied: {
    type: Boolean,
    default: false
  },
  resultAudioFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AudioFile'
  },
  executionTime: {
    type: Date
  },
  errorMessage: {
    type: String
  }
}, { 
  timestamps: true 
});

// Index for operation history queries
audioEditOperationSchema.index({ projectId: 1, createdAt: -1 });
audioEditOperationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AudioEditOperation', audioEditOperationSchema);