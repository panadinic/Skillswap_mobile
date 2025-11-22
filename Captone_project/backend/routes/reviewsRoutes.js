const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { createReview, getReviewsByPost } = require('../controllers/reviewsController');

router.post('/', authMiddleware, createReview);
router.get('/post/:postId', authMiddleware, getReviewsByPost);

module.exports = router;

