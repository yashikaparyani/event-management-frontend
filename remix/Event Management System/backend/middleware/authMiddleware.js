const { verifyToken } = require('../utils/auth');
const User = require('../models/User');

// These are the middlewares before performing the operations.

const authenticate = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    console.log(`token: ${token}`)
    if (!token) {
    
        return res.status(401).json({ message: 'Authentication failed: No token provided.' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ message: 'Authentication failed: Invalid token.' });
    }

    try {
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong during authentication.' });
    }
}; //checks if the user is authenicated of not

const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Authorization failed: Insufficient permissions.' });
        }
        next();
    };
}; //this checks the permission given by rgpv to the user.

const canModify = (req, res, next) => {
    const targetUserId = req.params.id;

    if (req.user.role === 'student') {
        return res.status(403).json({ message: 'Students cannot modify users.' });
    }

    if (req.user._id.toString() === targetUserId) {
        return res.status(403).json({ message: 'You cannot modify your own profile.' });
    }



    const userRole = req.user.role;
    const targetRole = req.targetUser.role;

    // Allow RGPV users to modify anyone
    if (userRole === 'rgpv') {
        return next();
    }

    // Allow modification if both users are from the same college (and not RGPV)
    if (req.user.role !== 'rgpv' && targetRole !== 'rgpv' && req.user.collegeName && req.targetUser.collegeName && req.user.collegeName === req.targetUser.collegeName) {
        return next();
    }

    // should the below be changed or not.

    const roleHierarchy = {
        'rgpv': 1,
        'college': 2,
        'director': 3,
        'hod': 4,
        'teacher': 5,
        'student': 6,
    };

    if (roleHierarchy[userRole] <= roleHierarchy[targetRole]) {
        return res.status(403).json({ message: `You cannot modify users of the same or higher role.` });
    }
    if (userRole === 'college' && ['college', 'rgpv'].includes(targetRole)) {
        return res.status(403).json({ message: `College users cannot modify other College or RGPV users.` });
    }
    if (userRole === 'director' && ['director', 'college', 'rgpv'].includes(targetRole)) {
        return res.status(403).json({ message: `Director users cannot modify other Director, College, or RGPV users.` });
    }
    if (userRole === 'hod' && ['hod', 'director', 'college', 'rgpv'].includes(targetRole)) {
        return res.status(403).json({ message: `HOD users cannot modify other HOD, Director, College, or RGPV users.` });
    }
    if (userRole === 'teacher' && ['teacher', 'hod', 'director', 'college', 'rgpv'].includes(targetRole)) {
        return res.status(403).json({ message: `Teacher users cannot modify other Teacher, HOD, Director, College, or RGPV users.` });
    }

    // If not RGPV and not the same college, deny modification
    return res.status(403).json({ message: 'You cannot modify users from a different college.' });
};

const setUserToModify = async (req, res, next) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ message: 'User to modify not found.' });
        }
        req.targetUser = targetUser;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Something went wrong while fetching user to modify.' });
    }
};

const roleHierarchy = {
    rgpv: ['college', 'director', 'hod', 'teacher', 'student'],
    college: ['director', 'hod', 'teacher', 'student'],
    director: ['hod', 'teacher', 'student'],
    hod: ['teacher', 'student'],
    teacher: ['student'],
    student: []
  };
  
//   gist of the permissions is here 
  const canOperate = (user, targetUser, operation) => {
    const userRole = user.role;
    const targetRole = targetUser.role;
  
    // RGPV can operate on anyone and override
    if (userRole === 'rgpv') return true;
  
    // Disallow operation if they're from different colleges
    if (user.collegeName !== targetUser.collegeName) return false;
  
    // Role-based check
    const canAccessByRole = roleHierarchy[userRole]?.includes(targetRole);
  
    // Permission-based check (must have permission for the action)
    const hasPermission = user.permissions?.includes(operation);
  
    return canAccessByRole && hasPermission;
  };
  

//canOperateMiddleware is the middleware that uses the canOperate function to determine if a user is authorized to perform a specific action on another user. 
const canOperateMiddleware = async (req, res, next) => {
    try {
      const operation = req.method === 'DELETE' ? 'delete' : 
                        req.method === 'PUT' ? 'update' :
                        req.method === 'POST' ? 'create' : 'read';
                        // req.method === 'POST' ? 'create' : 'read'
                        // Checks: "Is the request method POST?"
                        // If true: operation is assigned the string 'create'.
                        // If false: operation is assigned the string 'read'.  This is the default case, which means if the method is not DELETE, PUT, or POST, it's assumed to be something else (like GET), and the operation is considered a 'read'.


  
      const targetUser = await User.findById(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found.' });
      }
  
      if (!canOperate(req.user, targetUser, operation)) {
        return res.status(403).json({ message: 'You do not have permission to perform this operation.' });
      }
  
      req.targetUser = targetUser;
      next();
    } catch (error) {
      console.error('Error in canOperateMiddleware:', error);
      return res.status(500).json({ message: 'Something went wrong during authorization.' });
    }
  };
  

module.exports = { authenticate, authorize, canModify, setUserToModify, canOperateMiddleware };

// The user making the request is authenticated (authenticate).
// The targetUser to be modified has been fetched (setUserToModify).
// The canOperateMiddleware then checks if the authenticated user has the necessary permissions to modify the targetUser based on role hierarchy and college.