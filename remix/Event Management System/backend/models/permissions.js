const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  permissions: {
    // create: { type: Boolean, default: false },
    read: { type: Boolean, default: true },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    remix: {type:Boolean, default: false},
    spinner: {type:Boolean, default: false},
  }

}, { timestamps: true });

module.exports = mongoose.model('Permission', permissionSchema);





