const express = require('express');
const router = express.Router();
const userController = require('../controller/userController');
const authMiddleware = require('../middleware/auth');

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

module.exports = router;