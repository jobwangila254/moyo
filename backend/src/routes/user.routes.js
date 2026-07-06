const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validation = require('../middleware/validation.middleware');
const catchAsync = require('../utils/catchAsync');
const { prisma } = require('../prisma');

router.get('/counties', catchAsync(async (req, res) => {
  const counties = await prisma.county.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: counties });
}));

router.get('/profiles', authenticate, userController.getProfiles);
router.get('/profiles/:id', authenticate, validation.paramId, userController.getProfileById);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/swipe', authenticate, validation.swipe, userController.swipe);
router.get('/matches', authenticate, userController.getMatches);
router.get('/matches/:matchId/messages', authenticate, validation.matchId, userController.getMessages);
router.post(
  '/matches/:matchId/messages',
  authenticate,
  validation.matchId,
  validation.sendMessage,
  userController.sendMessage,
);
router.get('/likes/sent', authenticate, userController.getLikesSent);
router.get('/likes/received', authenticate, userController.getLikesReceived);
router.post('/likes/approve/:id', authenticate, validation.paramId, userController.approveLike);
router.post('/likes/use-free-unlock/:id', authenticate, validation.paramId, userController.useFreeUnlock);
router.post('/likes/dismiss/:id', authenticate, validation.paramId, userController.dismissLike);
router.post('/report', authenticate, validation.reportUser, userController.reportUser);
router.get('/safety-status', authenticate, userController.getSafetyStatus);
router.delete('/account', authenticate, userController.deleteAccount);
router.post('/push-token', authenticate, userController.updatePushToken);

module.exports = router;
