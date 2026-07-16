const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validation = require('../middleware/validation.middleware');

router.post('/stk-push', authenticate, validation.stkPush, paymentController.initiateSTKPush);
router.post('/bulk-stk', authenticate, validation.bulkSTK, paymentController.bulkSTKPush);
router.get('/status/:transactionId', authenticate, paymentController.getTransactionStatus);
router.get('/history', authenticate, paymentController.getTransactionHistory);
router.get('/payment-history', authenticate, paymentController.getPaymentHistory);

router.get('/subscriptions/current', authenticate, paymentController.getCurrentSubscription);
router.post('/subscriptions/:id/cancel', authenticate, paymentController.cancelSubscription);
router.get('/subscriptions/history', authenticate, paymentController.getSubscriptionHistory);
router.post('/subscriptions/change', authenticate, validation.changePlan, paymentController.changePlan);

const requireCallbackSecret = (req, _res, next) => {
  const secret = req.headers['x-callback-secret'];
  if (!secret || secret !== process.env.CALLBACK_SECRET) {
    return next(new (require('../middleware/errorHandler').AppError)('Unauthorized', 401));
  }
  next();
};

router.post('/callback', requireCallbackSecret, paymentController.mpesaCallback);

module.exports = router;
