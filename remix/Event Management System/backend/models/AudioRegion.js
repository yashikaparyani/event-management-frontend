const mongoose = require('mongoose');

const audioRegionSchema = new mongoose.Schema({
  audioFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AudioFile',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  regionName: {
    type: String,
    default: function() {
      return `Region_${Date.now()}`;
    }
  },
  startTime: {
    type: Number,
    required: true,
    min: 0
  },
  endTime: {
    type: Number,
    required: true,
    validate: {
      validator: function(value) {
        return value > this.startTime;
      },
      message: 'End time must be greater than start time'
    }
  },
  color: {
    type: String,
    default: '#ff0000'
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  metadata: {
    label: { type: String },
    notes: { type: String },
    tags: [{ type: String }]
  }
}, { 
  timestamps: true 
});

// Compound index for efficient queries
audioRegionSchema.index({ audioFileId: 1, projectId: 1 });
audioRegionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('AudioRegion', audioRegionSchema);