const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, checkCompanyAccess } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate, checkCompanyAccess);

// Get user's notifications
router.get('/', notificationController.getUserNotifications);

// Get unread count
router.get('/unread/count', notificationController.getUnreadCount);

// Get notification stats
router.get('/stats/overview', notificationController.getNotificationStats);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all as read
router.put('/actions/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
