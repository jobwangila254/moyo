const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validation = require('../middleware/validation.middleware');

router.post('/stk-push', authenticate, validation.stkPush, paymentController.initiateSTKPush);
router.get('/status/:transactionId', authenticate, paymentController.getTransactionStatus);
router.get('/history', authenticate, paymentController.getTransactionHistory);
const requireCallbackSecret = (req, _res, next) => {
  const secret = req.headers['x-callback-secret'];
  if (!secret || secret !== process.env.CALLBACK_SECRET) {
    return next(new (require('../middleware/errorHandler').AppError)('Unauthorized', 401));
  }
  next();
};

router.post('/callback', requireCallbackSecret, paymentController.mpesaCallback);

module.exports = router;
