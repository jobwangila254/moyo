const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validation = require('../middleware/validation.middleware');

router.post('/register', validation.register, authController.register);
router.post('/verify-phone', validation.verifyPhone, authController.verifyPhone);
router.post('/resend-code', validation.resendCode, authController.resendCode);
router.post('/login', validation.login, authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/forgot-password', validation.forgotPassword, authController.forgotPassword);
router.post('/reset-password', validation.resetPassword, authController.resetPassword);

module.exports = router;
