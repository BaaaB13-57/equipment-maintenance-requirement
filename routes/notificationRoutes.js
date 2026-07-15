const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification
} = require('../controllers/notificationController');

router.use(requireRole('user', 'admin', 'technician'));
router.get('/', getNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.delete('/:id', deleteNotification);

module.exports = router;
