const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize, setUserToModify, canOperateMiddleware } = require('../middleware/authMiddleware');
 
// -----------------------------------------------------------------------------
// This is all Bout the CRUD operations fun importing here.



router.post('/users',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher']),
    userController.createUser
); //to check in postman api


router.get('/users',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
    userController.getAllUsers
);   //to check in browser

router.get('/users/:id',
    authenticate,
    authorize(['rgpv', 'college', 'director', 'hod', 'teacher', 'student']),
    userController.getUserById
); //to check in browser

router.put('/users/:id',
    authenticate,
    setUserToModify, // Ensure targetUser is fetched
    canOperateMiddleware, // Check if the logged-in user can modify the target user
    userController.updateUser
); //to  check in postman 



router.delete('/users/:id',
    authenticate,
    // setUserToModify, // Ensure targetUser is fetched
    canOperateMiddleware, // Check if the logged-in user can delete the target user
    userController.deleteUser
);
// These types of rules require knowing the identity of both the user making the request (req.user from authenticate) and the user being targeted for deletion (req.params.id, which setUserToModify would fetch).

router.put('/users/:id/permissions', authenticate, 
    userController.updateUserPermissions);

module.exports = router;