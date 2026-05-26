const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/stk-push', authenticate, paymentController.initiateSTKPush);
router.get('/history', authenticate, paymentController.getTransactionHistory);
router.post('/callback', paymentController.mpesaCallback);

module.exports = router;
