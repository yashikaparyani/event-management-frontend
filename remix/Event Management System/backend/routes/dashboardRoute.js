const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/data', authenticate, dashboardController.getDashboardData);  //getting the curr user data only the name, email and other things.
router.get('/users', authenticate, authorize(['hod', 'teacher', 'college', 'director', 'rgpv']), dashboardController.getUsersForRole);


// router.get('/users/:role', authenticate, authorize(['hod', 'teacher', 'college', 'director', 'rgpv']), dashboardController.getUsersForRole);
//if we want to render according to the roles. 

module.exports = router;