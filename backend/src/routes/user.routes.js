const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { prisma } = require('../prisma');

router.get('/counties', async (req, res) => {
  try {
    const counties = await prisma.county.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: counties });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch counties' });
  }
});

router.get('/profiles', authenticate, userController.getProfiles);
router.get('/profiles/:id', authenticate, userController.getProfileById);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/swipe', authenticate, userController.swipe);
router.get('/matches', authenticate, userController.getMatches);
router.get('/matches/:matchId/messages', authenticate, userController.getMessages);
router.post('/matches/:matchId/messages', authenticate, userController.sendMessage);
router.get('/likes/sent', authenticate, userController.getLikesSent);
router.get('/likes/received', authenticate, userController.getLikesReceived);
router.post('/likes/approve/:likerId', authenticate, userController.approveLike);
router.post('/likes/dismiss/:likerId', authenticate, userController.dismissLike);
router.post('/report', authenticate, userController.reportUser);
router.get('/safety-status', authenticate, userController.getSafetyStatus);
router.delete('/account', authenticate, userController.deleteAccount);

module.exports = router;
