const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['rgpv', 'college', 'director', 'hod', 'teacher', 'student'],
    required: true
  },
  collegeName: { type: String },


  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Direct reporting user
  permissions: { type: [String], default: [] } // e.g., ['read', 'write', 'delete']
}, { timestamps: true });

// ------------------------------------


module.exports = mongoose.model('User', userSchema);
