const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { markConversationSeen } = require('../controllers/conversationsController');

router.post('/:conversationId/seen', authMiddleware, markConversationSeen);

module.exports = router;

