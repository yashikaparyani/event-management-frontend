// src/routes/spinnerWheelRoute.js
const express = require('express');
const router = express.Router();
const spinnerWheelController = require('../controllers/spinnerWheelController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Route to create a new spinner wheel template
router.post(
    '/',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher']), // Roles that can create spinner wheels
    spinnerWheelController.createSpinnerWheel
);

// Route to get all available spinner wheel templates (for dropdown)
router.get(
    '/',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']), // All authenticated users can see templates
    spinnerWheelController.getSpinnerWheelTemplates
);

// Route to get a specific spinner wheel by ID (to display it)
router.get(
    '/:id',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
    spinnerWheelController.getSpinnerWheelById
);

// Route to "spin" a specific spinner wheel (get a random outcome)
router.post( // Using POST for actions that change state or have side effects (even if just returning a result)
    '/:id/spin',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
    spinnerWheelController.spinSpinnerWheel
);

// Route to update a spinner wheel
router.put(
    '/:id',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher']), // Only creator or RGPV can update
    spinnerWheelController.updateSpinnerWheel
);

// Route to delete a spinner wheel
router.delete(
    '/:id',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher']), // Only creator or RGPV can delete
    spinnerWheelController.deleteSpinnerWheel
);

module.exports = router;