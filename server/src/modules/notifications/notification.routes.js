/**
 * PulseGrid AI — Notification Routes
 */

const router = require('express').Router();
const authenticate = require('../../middleware/authenticate');
const notificationService = require('./notification.service');
const ApiResponse = require('../../utils/apiResponse');

router.use(authenticate);

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, unreadOnly } = req.query;
    const result = await notificationService.getUserNotifications(req.user.id, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      unreadOnly: unreadOnly === 'true',
    });
    return ApiResponse.paginated(res, result.notifications, result.pagination, 'Notifications fetched');
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/read
router.patch('/read', async (req, res, next) => {
  try {
    const { ids } = req.body;
    await notificationService.markAsRead(req.user.id, ids);
    return ApiResponse.success(res, null, 'Notifications marked as read');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
