const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const commentController = require('../controller/commentController');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (_req, file, cb) => {
		const timestamp = Date.now();
		const safeName = file.originalname.replace(/\s+/g, '-');
		cb(null, `${timestamp}-${safeName}`);
	},
});

const upload = multer({ storage });

// GET /api/comments?lat=43.6532&lon=-79.3832&radius=500
router.get('/', commentController.getComments);

// POST /api/comments
router.post('/', commentController.createComment);

// POST /api/comments/upload
router.post('/upload', upload.single('file'), commentController.uploadMedia);

module.exports = router;