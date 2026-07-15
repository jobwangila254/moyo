const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateAdmin } = require('../middleware/admin.middleware');

router.post('/login', adminController.login);

router.use(authenticateAdmin);

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

router.get('/reports', adminController.getReports);
router.put('/reports/:id', adminController.updateReport);

router.get('/flagged-photos', adminController.getFlaggedPhotos);

router.get('/analytics/overview', adminController.getAnalyticsOverview);
router.get('/analytics/signups', adminController.getSignups);
router.get('/analytics/events', adminController.getEvents);

module.exports = router;
