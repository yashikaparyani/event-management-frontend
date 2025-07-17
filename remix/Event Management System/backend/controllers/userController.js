const User = require('../models/User');
const { hashPassword } = require('../utils/auth');


const roleHierarchy = {
    rgpv: ['college', 'director', 'hod', 'teacher', 'student'],
    college: ['director', 'hod', 'teacher', 'student'],
    director: ['hod', 'teacher', 'student'],
    hod: ['teacher', 'student'],
    teacher: ['student'],
    student: []
  };

  const canOperate = (req, targetUser) => {
    const userRole = req.user.role;
    const targetRole = targetUser.role;
  
    // RGPV can operate on anyone
    if (userRole === 'rgpv') return true;

    if (req.user.collegeName !== targetUser.collegeName )return false;
  
    if(userRole === 'college' && roleHierarchy[userRole]?.includes(targetRole) && req.user.collegeName === targetUser.collegeName)
      return true;

    


    // Deny if user and targetUser are from different colleges (except RGPV, already handled above)


  
    if(userRole === 'director' && roleHierarchy[userRole]?.includes(targetRole) && req.user.collegeName === targetUser.collegeName)
      return true;

    if(userRole === 'hod' && roleHierarchy[userRole]?.includes(targetRole) && req.user.collegeName === targetUser.collegeName)
      return true;

    if(userRole === 'teacher' && roleHierarchy[userRole]?.includes(targetRole) && req.user.collegeName === targetUser.collegeName)
      return true;

    if(userRole ==='student') return false

    

  };



const createUser = async (req, res) => {
    try {
        const { name, email, password, role, collegeName, permissions = [] } = req.body;

        // Validate collegeName for non-RGPV users
        if (role !== 'rgpv' && !collegeName) {
            return res.status(400).json({ message: 'College Name is required for non-RGPV users.' });
        }

        // Check for duplicate email
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already exists.' });
        }

        const creatorRole = req.user.role;
        const creatorCollege = req.user.collegeName;
        const creatorIndex = roleHierarchy.indexOf(creatorRole);
        const newUserIndex = roleHierarchy.indexOf(role);

        // RGPV can create anyone
        if (creatorRole !== 'rgpv') {
            // Can only create lower roles
            if (creatorIndex >= newUserIndex) {
                return res.status(403).json({ message: 'Cannot create user with same or higher role.' });
            }

            // Must be from the same college
            if (creatorCollege !== collegeName) {
                return res.status(403).json({ message: 'Cannot create user in a different college.' });
            }
        }

        const hashedPassword = await hashPassword(password);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            collegeName,
            parentId: req.user._id,  // Set creator as the parent
            permissions              // Optional permissions array
        });

        await newUser.save();
        res.status(201).json({ message: 'User created successfully.', user: newUser });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create user.' });
    }
};

  
  const getAllUsers = async (req, res) => {
    try {
      const { role, collegeName } = req.user;
  
      // Get all roles this user can access
      const allowedRoles = roleHierarchy[role] || [];
      // It uses the requesting user's role as a key to look up an array of allowed roles in roleHierarchy.
      // The || [] part ensures that if the requesting user's role is not found in roleHierarchy, allowedRoles will be an empty array, preventing errors.
      console.log(`${allowedRoles}  -------------${role}`)
  
      // Filter by roles and optionally by collegeName
      const query = { role: { $in: allowedRoles } };
      // role: { $in: allowedRoles } means that the query will look for users whose role field in the database is present in the allowedRoles array. This ensures that the function only fetches users with roles that the requesting user is authorized to view.
        console.log(`${query}`)
      // Only RGPV can access all colleges; others are restricted
      if (role !== 'rgpv') {
        query.collegeName = collegeName;
        // If the role is not 'rgpv', it adds an additional condition to the query: query.collegeName = collegeName;. This means that for users who are not 'rgpv', the query will be further restricted to only fetch users who belong to the same collegeName as the requesting user.
      }
  
      const users = await User.find(query); //await User.find(query) uses the find method of a Mongoose model (likely named User) to retrieve all documents (users) that match the constructed query.
      res.json(users); //: This line sends the fetched users as a JSON response to the client. This is a common way to send data from a server-side API.

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to fetch users.' });
    }
  };

const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch user.' });
    }
};

const updateUser = async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // if (!canOperate(req, targetUser)) {
        //     return res.status(403).json({ message: 'Cannot modify this user.' });
        // }

        const { name, email, password, role, collegeName } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (password) updateData.password = await hashPassword(password);
        if (role) updateData.role = role;
        if (role !== 'rgpv') updateData.collegeName = collegeName;
        else updateData.collegeName = undefined;

        const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: 'User updated successfully.', user: updatedUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update user.' });
    }
};

const deleteUser = async (req, res) => {
    console.log(`THis is id: ${req.params.id}`);
    try {
        const targetUser = await User.findById(req.params.id);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!canOperate(req, targetUser)) {
            return res.status(403).json({ message: 'Cannot delete this user.' });
        }
        console.log("This is string")
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
};



const updateUserPermissions = async (req, res) => {
    try {
      const { id } = req.params; //This line extracts the id parameter from the request's route parameters (req.params)
      const { permissions } = req.body; //const { permissions } = req.body;: This line extracts the permissions from the request's body (req.body). It's expected that the client will send the new permissions for the user in the request body, likely as a JSON array.
  
      // Allow only RGPV to assign permissions
      if (req.user.role !== 'rgpv' && req.user.role !=='director') {
        return res.status(403).json({ message: 'Only RGPV users and directors of their respective colleges can assign permissions.' });
      } //
  
      const validPermissions = ['create', 'read', 'update', 'delete', 'remix','spinner'];
  
      if (
        !Array.isArray(permissions) ||
        permissions.some(p => !validPermissions.includes(p))
      ) {
        return res.status(400).json({ message: 'Invalid permissions provided.' });
      }
  
      const targetUser = await User.findById(id);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found.' });
      }
  
      if (targetUser.role === 'rgpv') {
        return res.status(403).json({ message: 'Cannot assign permissions to another RGPV user.' });
      }
  
      targetUser.permissions = permissions;
      await targetUser.save();
  
      res.status(200).json({ message: 'Permissions updated successfully.', user: targetUser });
    } catch (error) {
      console.error('Permission update failed:', error);
      res.status(500).json({ message: 'Failed to update user permissions.' });
    }
  };



module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    canOperate, // Export the canOperate function
    updateUserPermissions,
};

