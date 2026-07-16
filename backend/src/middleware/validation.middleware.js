const { body, param, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

const VALID_GENDERS = ['male', 'female', 'non-binary', 'other'];
const VALID_DIRECTIONS = ['like', 'pass', 'superlike'];
const VALID_PAYMENT_TYPES = [
  'match_unlock', 'like_viewer', 'like_unlock',
  'daily_chat_unlock',
  'subscription_weekly', 'subscription_fortnightly', 'subscription_monthly',
  'subscription_halfyear', 'subscription_yearly',
];

const handleValidationErrors = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => e.msg);
    return next(new AppError(messages.join('. '), 400));
  }
  next();
};

const register = [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[\d\s\-()]{7,15}$/)
    .withMessage('Invalid phone number format'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters'),
  body('age')
    .notEmpty()
    .withMessage('Age is required')
    .isInt({ min: 18, max: 120 })
    .withMessage('Age must be between 18 and 120'),
  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(VALID_GENDERS)
    .withMessage(`Gender must be one of: ${VALID_GENDERS.join(', ')}`),
  body('countyId').notEmpty().withMessage('County is required').isInt({ min: 1 }).withMessage('Invalid county'),
  body('interestedIn')
    .optional()
    .isIn(VALID_GENDERS.concat('both'))
    .withMessage(`interestedIn must be one of: ${VALID_GENDERS.concat('both').join(', ')}`),
  handleValidationErrors,
];

const verifyPhone = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Code must be 6 digits'),
  handleValidationErrors,
];

const login = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const swipe = [
  body('swipedId').notEmpty().withMessage('swipedId is required').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('direction')
    .notEmpty()
    .withMessage('Direction is required')
    .isIn(VALID_DIRECTIONS)
    .withMessage('Direction must be "like", "pass", or "superlike"'),
  handleValidationErrors,
];

const sendMessage = [
  body('content')
    .notEmpty()
    .withMessage('Message content is required')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be 1-1000 characters'),
  handleValidationErrors,
];

const reportUser = [
  body('reportedId').notEmpty().withMessage('reportedId is required').isInt({ min: 1 }).withMessage('Invalid user ID'),
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Reason must be 3-500 characters'),
  body('details').optional().trim().isLength({ max: 2000 }).withMessage('Details must be at most 2000 characters'),
  handleValidationErrors,
];

const stkPush = [
  body('phone')
    .if(body('phoneNumber').not().exists())
    .notEmpty()
    .withMessage('Phone number is required'),
  body('phoneNumber')
    .if(body('phone').not().exists())
    .notEmpty()
    .withMessage('Phone number is required'),
  body('type')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(VALID_PAYMENT_TYPES)
    .withMessage(`Type must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`),
  body('matchId')
    .if(body('type').equals('match_unlock'))
    .notEmpty()
    .withMessage('matchId required for match_unlock')
    .isInt()
    .withMessage('Invalid match ID'),
  body('matchId')
    .if(body('type').equals('like_unlock'))
    .notEmpty()
    .withMessage('likerId required for like_unlock')
    .isInt()
    .withMessage('Invalid liker ID'),
  handleValidationErrors,
];

const bulkSTK = [
  body('payments')
    .isArray({ min: 1, max: 10 })
    .withMessage('payments must be an array of 1-10 items'),
  body('payments.*.phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required for each payment'),
  body('payments.*.amount')
    .isInt({ min: 1 })
    .withMessage('Amount must be a positive integer'),
  body('payments.*.type')
    .notEmpty()
    .withMessage('Payment type is required for each payment')
    .isIn(VALID_PAYMENT_TYPES)
    .withMessage(`Type must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`),
  handleValidationErrors,
];

const changePlan = [
  body('plan')
    .notEmpty()
    .withMessage('Plan is required')
    .isIn(['subscription_weekly', 'subscription_fortnightly', 'subscription_monthly', 'subscription_halfyear', 'subscription_yearly'])
    .withMessage('Invalid plan'),
  body('paymentMethod')
    .optional()
    .isIn(['mpesa', 'card'])
    .withMessage('Payment method must be mpesa or card'),
  handleValidationErrors,
];

const paramId = [param('id').isInt({ min: 1 }).withMessage('Invalid ID parameter'), handleValidationErrors];

const matchId = [param('matchId').isInt({ min: 1 }).withMessage('Invalid match ID'), handleValidationErrors];

const resendCode = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  handleValidationErrors,
];

const forgotPassword = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  handleValidationErrors,
];

const resetPassword = [
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('code')
    .notEmpty()
    .isLength({ min: 6, max: 6 })
    .withMessage('Code must be 6 digits'),
  body('password')
    .notEmpty()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  handleValidationErrors,
];

module.exports = {
  register,
  verifyPhone,
  login,
  resendCode,
  forgotPassword,
  resetPassword,
  swipe,
  sendMessage,
  reportUser,
  stkPush,
  bulkSTK,
  changePlan,
  paramId,
  matchId,
};
