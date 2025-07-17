// index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);


const app = express();
app.use(express.json());

// 1. Enable CORS for Vite frontend (http://localhost:5173)
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (uploaded audio files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. FFmpeg check function (from your existing code)
let ffmpegPath = '';
async function checkFfmpeg() {
  try {
    const { stdout } = await execPromise('which ffmpeg');
    ffmpegPath = stdout.trim();
    console.log(`FFmpeg found at: ${ffmpegPath}`);
    return true;
  } catch (error) {
    console.warn('FFmpeg not found in PATH. Audio processing features may not work.');
    return false;
  }
}

// 3. Import routes
const authRoute = require('./routes/authRoute');
const userRoute = require('./routes/userRoute');
const dashboardRoute = require('./routes/dashboardRoute');
const audioRoutes = require('./routes/audioRoutes');
// const spinnerWheelRoutes = require('./routes/spinnerWheelRoutes'); 

// 4. Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Check FFmpeg availability before starting the server
    return checkFfmpeg();
  })
  .then(ffmpegAvailable => {
    // Store FFmpeg availability and path in app locals
    app.locals.ffmpegAvailable = ffmpegAvailable;
    app.locals.ffmpegPath = ffmpegPath;
    
    // 5. Use API routes
    app.use('/api/auth', authRoute);
    app.use('/api/users', userRoute);
    app.use('/api/dashboard', dashboardRoute);
    app.use('/api/audio', audioRoutes); 
    // app.use('/api/spinner-wheels', spinnerWheelRoutes); 

    // 404 handler for undefined routes
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });
    
    // Start the server
    const port = process.env.SERVER_PORT || 3000;
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process if database connection fails
  });