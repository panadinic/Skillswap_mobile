const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createMeetingRequestNotification,
  respondMeetingRequest,
  cleanupOldNotifications,
} = require('../controllers/notificationsController');

router.get('/', authMiddleware, getMyNotifications);
router.post('/mark-all/read', authMiddleware, markAllNotificationsRead);
router.post('/meeting-request', authMiddleware, createMeetingRequestNotification);
router.post('/meeting-request/respond', authMiddleware, respondMeetingRequest);
router.post('/:notificationId/read', authMiddleware, markNotificationRead);
router.post('/cleanup/old', authMiddleware, cleanupOldNotifications);

module.exports = router;
