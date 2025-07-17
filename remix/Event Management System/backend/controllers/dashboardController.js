const User = require('../models/User');

const getDashboardData = async (req, res) => {
    try {
        const userData = {
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            collegeName: req.user.collegeName,
        };
        res.json(userData);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard data.' });
    }
};

const getUsersForRole = async (req, res) => {
    const { role } = req.params;
    try {
        let query = { role: role };
        if (req.user.role !== 'rgpv' && req.user.collegeName) {
            query.collegeName = req.user.collegeName;
        }
        const users = await User.find(query).select('name _id'); // Only fetch name and _id
        res.json(users);
    } catch (error) {
        console.error(`Error fetching users for role ${role}:`, error);
        res.status(500).json({ message: `Failed to fetch users for role ${role}.` });
    }
};

// -----------------------------------





// -----------------------------------




module.exports = { getDashboardData, getUsersForRole, };