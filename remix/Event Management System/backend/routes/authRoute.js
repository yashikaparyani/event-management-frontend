const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signup); // authController - It's a reference to a function that will be executed when a POST request is made to the /signup endpoint.
router.post('/login', authController.login);
router.post('/logout', authController.logout);


module.exports = router;