const express = require('express');
const router = express.Router();
const commentController = require('../controller/commentController');

// GET /api/comments?lat=43.6532&lon=-79.3832&radius=500
router.get('/', commentController.getComments);

// POST /api/comments
router.post('/', commentController.createComment);

module.exports = router;