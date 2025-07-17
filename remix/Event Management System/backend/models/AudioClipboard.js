const mongoose = require('mongoose');

const audioClipboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourceAudioFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AudioFile',
    required: true
  },
  clipboardData: {
    startTime: {
      type: Number,
      required: true,
      min: 0
    },
    endTime: {
      type: Number,
      required: true
    },
    audioBuffer: {
      type: String, // Base64 encoded audio data for small clips
      required: function() {
        return this.duration <= 30; // Only store buffer for clips <= 30 seconds
      }
    },
    tempFilePath: {
      type: String // For larger clips, store temp file path
    },
    duration: {
      type: Number,
      required: true
    }
  },
  operationType: {
    type: String,
    enum: ['cut', 'copy'],
    required: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    },
    index: { expireAfterSeconds: 0 }
  }
}, { 
  timestamps: true 
});

// TTL index for automatic cleanup
audioClipboardSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AudioClipboard', audioClipboardSchema);