const express = require('express');
const router = express.Router();
const multer = require('multer');
const commentController = require('../controller/commentController');
const authMiddleware = require('../middleware/auth');
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/comments?lat=43.6532&lon=-79.3832&radius=500
router.get('/', commentController.getComments);

// POST /api/comments
router.post('/', commentController.createComment);

// POST /api/comments/:commentId/like
router.post('/:commentId/like', authMiddleware, commentController.toggleLike);

// POST /api/comments/upload
router.post('/upload', upload.single('file'), commentController.uploadMedia);

// GET /api/comments/media/:id
router.get('/media/:id', commentController.getMedia);

module.exports = router;