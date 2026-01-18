const express = require('express');
const router = express.Router();
const aiController = require('../controller/aiController');

// POST /api/ai/identity
router.post('/identity', aiController.identityChat);

module.exports = router;
