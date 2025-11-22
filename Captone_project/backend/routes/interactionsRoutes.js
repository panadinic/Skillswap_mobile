const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { likePublication, getMyMatches, getMyLikes } = require('../controllers/interactionsController');

// Protegidas
router.post('/like', authMiddleware, likePublication);
router.get('/matches', authMiddleware, getMyMatches);
router.get('/likes', authMiddleware, getMyLikes);

module.exports = router;
