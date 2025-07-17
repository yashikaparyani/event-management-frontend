const User = require('../models/User');
const { hashPassword, comparePassword, generateToken } = require('../utils/auth');

const signup = async (req, res) => {
    try {
        const { name, email, password, role, collegeName } = req.body;




        if (role !== 'rgpv' && !collegeName) {
            return res.status(400).json({ message: 'College Name is required for non-RGPV users.' });
        }




                // Check for existing director in the same college (case-insensitive)
                if (role === 'director') {
                    const existingDirector = await User.findOne({ 
                        role: 'director', 
                        collegeName: collegeName 
                    });
                    if (existingDirector) {
                        return res.status(409).json({ 
                            message: 'A director already exists for this college.' 
                        });
                    }
                }
        
        

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'This Email already exists.' });
        }

        const hashedPassword = await hashPassword(password);
        const newUser = new User({ name, email, password: hashedPassword, role, collegeName });
        await newUser.save();

        res.status(201).json({ message: 'User created successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong during signup.' });
    }


    
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await comparePassword(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const token = generateToken(user.id, user.role); //user.id was automatically generated when the obj was created of the user.
        res.json({ token, role: user.role, _id:user.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong during login.' });
    }
};

const logout = (req, res) => {
    res.json({ message: 'Logged out successfully.' });
};

module.exports = { signup, login, logout };