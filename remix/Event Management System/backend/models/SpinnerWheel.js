// src/models/SpinnerWheel.js
const mongoose = require('mongoose');

const spinnerOptionSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true
    },
    value: {
        type: String, // Can be used for internal ID, or same as label
        required: true,
        trim: true
    },
    color: {
        type: String, // Hex code like #FF0000
        default: '#808080' // Default to grey
    },
    weight: {
        type: Number, // Optional: for weighted outcomes (e.g., 1 = low chance, 10 = high chance)
        default: 1,
        min: 0
    }
}, { _id: false }); // Do not create _id for subdocuments if not needed

const spinnerWheelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    description: {
        type: String,
        trim: true,
        default: 'A customizable spinner wheel.'
    },
    type: {
        type: String,
        enum: ['standard', 'prize', 'educational', 'decision'], // Example types
        default: 'standard'
    },
    options: {
        type: [spinnerOptionSchema], // Array of embedded spinner options
        required: true,
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'A spinner wheel must have at least one option.'
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    isPublic: {
        type: Boolean,
        default: false // Can be public or private
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Index for efficient lookup
spinnerWheelSchema.index({ createdBy: 1, name: 1 });
spinnerWheelSchema.index({ type: 1 });
spinnerWheelSchema.index({ isPublic: 1 });


module.exports = mongoose.model('SpinnerWheel', spinnerWheelSchema);