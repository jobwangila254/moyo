const { prisma } = require('../prisma');
const { Daraja } = require('../config/mpesa.config');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { sendPushNotification } = require('../services/notificationService');

const MATCH_UNLOCK_PRICE = 10;
const LIKE_VIEWER_PRICE = 50;
const LIKE_UNLOCK_PRICE = 20;
const PRICES = {
  match_unlock: MATCH_UNLOCK_PRICE,
  like_viewer: LIKE_VIEWER_PRICE,
  like_unlock: LIKE_UNLOCK_PRICE,
  daily_chat_unlock: 30,
  subscription_weekly: 150,
  subscription_fortnightly: 250,
  subscription_monthly: 500,
  subscription_halfyear: 2500,
  subscription_yearly: 5000,
};

function formatPhone(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    return `254${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('7')) {
    return `254${cleaned}`;
  }
  if (cleaned.startsWith('254')) {
    return cleaned;
  }
  return cleaned;
}

function mpesaTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function mpesaPassword(shortCode, passkey, timestamp) {
  const str = shortCode + passkey + timestamp;
  return Buffer.from(str).toString('base64');
}

const applyPaymentBenefit = async (type, userId, matchId) => {
  if (type === 'match_unlock' && matchId) {
    await prisma.match.update({
      where: { id: parseInt(matchId, 10) },
      data: { unlocked: true },
    });
    await sendPushNotification(userId, 'Match Unlocked 💕', 'Start chatting unlimitedly!');
  } else if (type === 'like_unlock' && matchId) {
    const likerId = parseInt(matchId, 10);
    const existingSwipeBack = await prisma.swipe.findUnique({
      where: { swiperId_swipedId: { swiperId: userId, swipedId: likerId } },
    });
    if (!existingSwipeBack) {
      await prisma.swipe.create({ data: { swiperId: userId, swipedId: likerId, direction: 'like' } });
    }
    const u1 = Math.min(userId, likerId);
    const u2 = Math.max(userId, likerId);
    let actualMatchId;
    const existingMatch = await prisma.match.findFirst({
      where: { OR: [{ user1Id: u1, user2Id: u2 }] },
    });
    if (!existingMatch) {
      const newMatch = await prisma.match.create({ data: { user1Id: u1, user2Id: u2, unlocked: true } });
      actualMatchId = newMatch.id;
    } else {
      if (!existingMatch.unlocked) {
        await prisma.match.update({ where: { id: existingMatch.id }, data: { unlocked: true } });
      }
      actualMatchId = existingMatch.id;
    }
    await sendPushNotification(userId, 'Like Revealed! 💕', 'Check out who liked you and match!');
    return actualMatchId;
  } else if (type === 'daily_chat_unlock') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.user.update({
      where: { id: userId },
      data: { chatUnlockDate: today },
    });
    await sendPushNotification(userId, 'Daily Chat Unlocked 💕', 'Unlimited chat activated for today!');
  } else if (type.startsWith('subscription')) {
    const UNLOCK_CREDITS = {
      subscription_weekly: 1,
      subscription_fortnightly: 2,
      subscription_monthly: 8,
      subscription_halfyear: 999,
      subscription_yearly: 999,
    };
    const TIER_UPGRADES = {
      subscription_weekly: true,
      subscription_fortnightly: true,
      subscription_monthly: true,
      subscription_halfyear: true,
      subscription_yearly: true,
    };
    const credits = UNLOCK_CREDITS[type] || 0;
    const premium = TIER_UPGRADES[type] || false;
    const updateData = { unlimitedChat: true };
    if (premium) { updateData.tier = 'PREMIUM'; }
    if (credits > 0) { updateData.freeUnlocksRemaining = { increment: credits }; }
    await prisma.user.update({ where: { id: userId }, data: updateData });
    await prisma.match.updateMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }], unlocked: false },
      data: { unlocked: true },
    });
    await sendPushNotification(userId, premium ? 'Welcome to Premium! ✨' : 'Subscription Active 💕', premium ? 'You can now browse all counties and enjoy unlimited features.' : 'Enjoy unlimited chat on all your matches!');
  } else if (type === 'like_viewer') {
    await sendPushNotification(userId, 'Likes Unlocked 💕', 'You can now see who likes you!');
  }
};

const processPayment = async (transaction, type, matchId, userId) => {
  const existing = await prisma.transaction.findUnique({ where: { id: transaction.id } });
  if (existing.status === 'completed') { return; }

  const updateData = { status: 'completed' };
  if (!existing.mpesaReceipt) {
    updateData.mpesaReceipt = `SIM${Date.now()}`;
  }
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: updateData,
  });

  const actualMatchId = await applyPaymentBenefit(type, userId, matchId);
  if (type === 'like_unlock' && actualMatchId) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { matchId: actualMatchId },
    });
  }
};

exports.initiateSTKPush = catchAsync(async (req, res) => {
  const { phoneNumber, phone: phoneAlias, amount, type, matchId } = req.body;
  const phone = phoneNumber || phoneAlias;

  if (type === 'match_unlock' && !matchId) {
    throw new AppError('matchId required for match_unlock', 400);
  }
  if (type === 'like_unlock' && !matchId) {
    throw new AppError('likerId required for like_unlock', 400);
  }

  const expectedAmount = PRICES[type];
  if (!expectedAmount) {
    throw new AppError(`Invalid payment type: ${type}`, 400);
  }
  const paymentAmount = amount || expectedAmount;
  if (parseInt(paymentAmount, 10) !== expectedAmount) {
    throw new AppError(`Invalid amount. Expected Ksh ${expectedAmount}`, 400);
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: req.userId,
      type,
      amount: expectedAmount,
      matchId: matchId ? parseInt(matchId, 10) : null,
      status: 'pending',
    },
  });

  const useRealMpesa = process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET
    && process.env.MPESA_CONSUMER_KEY !== 'your_consumer_key'
    && process.env.MPESA_CONSUMER_SECRET !== 'your_consumer_secret';
  if (useRealMpesa) {
    const formattedPhone = formatPhone(phone);
    const timestamp = mpesaTimestamp();
    const password = mpesaPassword(process.env.MPESA_SHORTCODE, process.env.MPESA_PASSKEY, timestamp);

    const result = await Daraja.initiateSTKPush({
      amount: expectedAmount,
      phoneNumber: formattedPhone,
      timestamp,
      password,
      accountReference: type === 'match_unlock' ? `MATCH_${matchId}` : `PREMIUM_${req.userId}`,
      transactionDesc: type === 'match_unlock' ? 'Match Unlock' : type === 'daily_chat_unlock' ? 'Daily Chat' : 'Moyo Premium',
    });

    if (result.ResponseCode === '0') {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { mpesaReceipt: result.MerchantRequestID },
      });

      setTimeout(async () => {
        try {
          const statusResult = await Daraja.queryStatus({
            checkoutRequestId: result.CheckoutRequestID,
            timestamp,
            password,
          });

          if (statusResult.ResultCode === '0') {
            await processPayment(transaction, type, matchId, req.userId);
          } else {
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: 'failed' },
            });
          }
        } catch {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          });
        }
      }, 15000);

      res.json({
        success: true,
        message: 'STK Push sent. Check your phone and enter M-Pesa PIN.',
        data: { transactionId: transaction.id },
      });
    } else {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'failed' },
      });
      throw new AppError(result.CustomerMessage || 'M-Pesa request failed', 400);
    }
  } else {
    logger.info(`[MPESA SIMULATION] STK Push sent to ${phone} for Ksh ${expectedAmount} (${type})`);

    setTimeout(async () => {
      try {
        await processPayment(transaction, type, matchId, req.userId);
        logger.info(
          `  → ${type === 'match_unlock' ? `Match ${matchId} unlocked` : type === 'like_unlock' ? `Like back completed for user ${req.userId}` : type.startsWith('subscription') ? `User ${req.userId} upgraded to PREMIUM (${type})` : `Like viewer access granted for user ${req.userId}`}`,
        );
      } catch (err) {
        logger.error('Callback processing error:', err);
        try {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'failed' },
          });
        } catch { /* ignore */ }
      }
    }, 3000);

    res.json({
      success: true,
      message: 'STK Push initiated. Please check your phone and enter your M-Pesa PIN.',
      data: { transactionId: transaction.id },
    });
  }
});

exports.mpesaCallback = catchAsync(async (req, res) => {
  const { Body } = req.body;
  if (!Body || !Body.stkCallback) {
    return res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
  }

  const { ResultCode, MerchantRequestID, CallbackMetadata } = Body.stkCallback;

  if (ResultCode === 0) {
    const receipt =
      CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value || `CALLBACK${Date.now()}`;

    const transaction = await prisma.transaction.findFirst({
      where: { mpesaReceipt: MerchantRequestID, status: 'pending' },
    });

    if (transaction) {
      const existingTx = await prisma.transaction.findUnique({ where: { id: transaction.id } });
      if (existingTx.status === 'completed') {
        return res.json({ ResultCode: 0, ResultDesc: 'Success' });
      }
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'completed', mpesaReceipt: receipt },
      });

      const actualMatchId = await applyPaymentBenefit(transaction.type, transaction.userId, transaction.matchId);
      if (transaction.type === 'like_unlock' && actualMatchId) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { matchId: actualMatchId },
        });
      }
    }
  }

  res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

exports.getTransactionStatus = catchAsync(async (req, res) => {
  const transactionId = parseInt(req.params.transactionId, 10);
  if (isNaN(transactionId)) {
    throw new AppError('Invalid transaction ID', 400);
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    throw new AppError('Transaction not found', 404);
  }
  if (transaction.userId !== req.userId) {
    throw new AppError('Unauthorized', 403);
  }

  res.json({ success: true, data: transaction });
});

exports.getTransactionHistory = catchAsync(async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({ success: true, data: transactions });
});
