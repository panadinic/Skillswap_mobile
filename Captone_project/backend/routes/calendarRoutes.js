const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { createFromSchedule, getMyEvents, cancelEvent } = require('../controllers/calendarController');

// Require auth for calendar operations
router.post('/events/from-schedule', authMiddleware, createFromSchedule);
router.get('/events', authMiddleware, getMyEvents);
router.post('/events/:id/cancel', authMiddleware, cancelEvent);

module.exports = router;
