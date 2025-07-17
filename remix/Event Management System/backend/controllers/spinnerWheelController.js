// src/controllers/spinnerWheelController.js
const SpinnerWheel = require('../models/SpinnerWheel');
const User = require('../models/User'); // Assuming you might need user info for permissions

const spinnerWheelController = {

    // 1. Create a new Spinner Wheel (Admin/Authorized User)
    createSpinnerWheel: async (req, res) => {
        try {
            const { name, description, type, options, isPublic } = req.body;
            const createdBy = req.user._id; // Get user ID from authenticated request

            // Basic validation for options structure
            if (!Array.isArray(options) || options.length === 0) {
                return res.status(400).json({ message: 'Spinner wheel must have at least one option.' });
            }
            if (options.some(opt => !opt.label || !opt.value)) {
                return res.status(400).json({ message: 'Each spinner option must have a label and a value.' });
            }

            const newSpinnerWheel = new SpinnerWheel({
                name,
                description,
                type,
                options,
                createdBy,
                isPublic: isPublic || false // Default to private if not specified
            });

            await newSpinnerWheel.save();
            res.status(201).json({
                message: 'Spinner wheel created successfully.',
                spinnerWheel: newSpinnerWheel
            });

        } catch (error) {
            console.error('Error creating spinner wheel:', error);
            if (error.code === 11000) { // Duplicate key error
                return res.status(409).json({ message: 'A spinner wheel with this name already exists.' });
            }
            res.status(500).json({ message: 'Failed to create spinner wheel.' });
        }
    },

    // 2. Get all available Spinner Wheel types/templates (e.g., for selection dropdown)
    getSpinnerWheelTemplates: async (req, res) => {
        try {
            // Fetch public templates or templates created by the user
            const userId = req.user._id;
            const spinnerWheels = await SpinnerWheel.find({
                $or: [{ isPublic: true }, { createdBy: userId }]
            }).select('name description type createdBy isPublic options'); // Select relevant fields

            res.status(200).json(spinnerWheels);
        } catch (error) {
            console.error('Error fetching spinner wheel templates:', error);
            res.status(500).json({ message: 'Failed to fetch spinner wheel templates.' });
        }
    },

    // 3. Get a specific Spinner Wheel by ID (to display its options and prepare for spinning)
    getSpinnerWheelById: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user._id;

            const spinnerWheel = await SpinnerWheel.findById(id);

            if (!spinnerWheel) {
                return res.status(404).json({ message: 'Spinner wheel not found.' });
            }

            // Check if user has access (public or created by user)
            if (!spinnerWheel.isPublic && spinnerWheel.createdBy.toString() !== userId.toString()) {
                return res.status(403).json({ message: 'You do not have permission to access this spinner wheel.' });
            }

            res.status(200).json(spinnerWheel);
        } catch (error) {
            console.error('Error fetching spinner wheel by ID:', error);
            res.status(500).json({ message: 'Failed to fetch spinner wheel.' });
        }
    },

    // 4. Simulate a spin and return the selected option
    // (This can be more complex with weighted options if needed)
    spinSpinnerWheel: async (req, res) => {
        try {
            const { id } = req.params; // ID of the spinner wheel to spin
            const spinnerWheel = await SpinnerWheel.findById(id);

            if (!spinnerWheel) {
                return res.status(404).json({ message: 'Spinner wheel not found.' });
            }

            // Basic validation for options, ensure it has options
            if (!spinnerWheel.options || spinnerWheel.options.length === 0) {
                return res.status(400).json({ message: 'This spinner wheel has no options to spin.' });
            }

            // Simple random selection for now
            const randomIndex = Math.floor(Math.random() * spinnerWheel.options.length);
            const selectedOption = spinnerWheel.options[randomIndex];

            // If you want weighted outcomes, you'd implement logic here:
            // let totalWeight = spinnerWheel.options.reduce((sum, opt) => sum + opt.weight, 0);
            // let randomNum = Math.random() * totalWeight;
            // for (let i = 0; i < spinnerWheel.options.length; i++) {
            //     if (randomNum < spinnerWheel.options[i].weight) {
            //         selectedOption = spinnerWheel.options[i];
            //         break;
            //     }
            //     randomNum -= spinnerWheel.options[i].weight;
            // }

            res.status(200).json({
                message: 'Spinner wheel spun successfully!',
                selectedOption: {
                    label: selectedOption.label,
                    value: selectedOption.value
                }
            });

        } catch (error) {
            console.error('Error spinning spinner wheel:', error);
            res.status(500).json({ message: 'Failed to spin spinner wheel.' });
        }
    },

    // 5. Update a Spinner Wheel (Admin/Creator)
    updateSpinnerWheel: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user._id;
            const updates = req.body;

            const spinnerWheel = await SpinnerWheel.findById(id);

            if (!spinnerWheel) {
                return res.status(404).json({ message: 'Spinner wheel not found.' });
            }

            // Only creator or RGPV can update
            if (spinnerWheel.createdBy.toString() !== userId.toString() && req.user.role !== 'rgpv') {
                return res.status(403).json({ message: 'You do not have permission to update this spinner wheel.' });
            }

            // Apply updates
            Object.keys(updates).forEach(key => {
                if (key in spinnerWheel && key !== '_id' && key !== 'createdBy' && key !== 'createdAt' && key !== 'updatedAt') {
                    spinnerWheel[key] = updates[key];
                }
            });

            // Re-validate options if they are updated
            if (updates.options) {
                if (!Array.isArray(updates.options) || updates.options.length === 0) {
                    return res.status(400).json({ message: 'Spinner wheel must have at least one option.' });
                }
                if (updates.options.some(opt => !opt.label || !opt.value)) {
                    return res.status(400).json({ message: 'Each spinner option must have a label and a value.' });
                }
            }


            await spinnerWheel.save();
            res.status(200).json({ message: 'Spinner wheel updated successfully.', spinnerWheel });

        } catch (error) {
            console.error('Error updating spinner wheel:', error);
            if (error.code === 11000) {
                return res.status(409).json({ message: 'A spinner wheel with this name already exists.' });
            }
            res.status(500).json({ message: 'Failed to update spinner wheel.' });
        }
    },

    // 6. Delete a Spinner Wheel (Admin/Creator)
    deleteSpinnerWheel: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.user._id;

            const spinnerWheel = await SpinnerWheel.findById(id);

            if (!spinnerWheel) {
                return res.status(404).json({ message: 'Spinner wheel not found.' });
            }

            // Only creator or RGPV can delete
            if (spinnerWheel.createdBy.toString() !== userId.toString() && req.user.role !== 'rgpv') {
                return res.status(403).json({ message: 'You do not have permission to delete this spinner wheel.' });
            }

            await spinnerWheel.deleteOne(); // Use deleteOne() on the document instance
            res.status(200).json({ message: 'Spinner wheel deleted successfully.' });

        } catch (error) {
            console.error('Error deleting spinner wheel:', error);
            res.status(500).json({ message: 'Failed to delete spinner wheel.' });
        }
    }
};

module.exports = spinnerWheelController;