const express = require('express');
const router = express.Router();
const friendController = require('../controller/friendController');
const authMiddleware = require('../middleware/auth');

// Protected routes (require authentication)
// POST /api/friends/request - Send friend request
router.post('/request', authMiddleware, friendController.sendFriendRequest);

// POST /api/friends/accept - Accept friend request
router.post('/accept', authMiddleware, friendController.acceptFriendRequest);

// POST /api/friends/reject - Reject friend request
router.post('/reject', authMiddleware, friendController.rejectFriendRequest);

// GET /api/friends/requests - Get pending friend requests
router.get('/requests', authMiddleware, friendController.getFriendRequests);

// POST /api/friends/remove - Remove friend
router.post('/remove', authMiddleware, friendController.removeFriend);

// Public routes - placed after specific routes to avoid conflicts
// GET /api/friends/search - Search users by username
router.get('/search', friendController.searchUsers);

// GET /api/friends/user/:userId - Get friends list of a user
router.get('/user/:userId', friendController.getFriends);

module.exports = router;
