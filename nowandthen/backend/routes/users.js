const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const userController = require('../controller/userController');
const authMiddleware = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Public routes
// POST /api/users/register
router.post('/register', userController.register);

// POST /api/users/login
router.post('/login', userController.login);

// Protected routes (require authentication)
// GET /api/users/me - Get current user
router.get('/me', authMiddleware, userController.getCurrentUser);

// GET /api/users/:userId - Get user by ID
router.get('/:userId', userController.getUserById);

// PUT /api/users/profile-photo - Upload/update profile photo
router.put('/profile-photo', authMiddleware, upload.single('photo'), userController.updateProfilePhoto);

module.exports = router;