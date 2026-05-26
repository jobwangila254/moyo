const { prisma, safeJsonParse } = require('../prisma');
const { Daraja } = require('../config/mpesa.config');

const MATCH_UNLOCK_PRICE = 50;
const PREMIUM_SUBSCRIPTION_PRICE = 500;
const LIKE_VIEWER_PRICE = 50;

function formatPhone(phone) {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) return '254' + cleaned.slice(1);
  if (cleaned.startsWith('7')) return '254' + cleaned;
  if (cleaned.startsWith('254')) return cleaned;
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

const processPayment = async (transaction, type, matchId, userId) => {
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: 'completed', mpesaReceipt: `SIM${Date.now()}` },
  });

  if (type === 'match_unlock' && matchId) {
    await prisma.match.update({
      where: { id: parseInt(matchId) },
      data: { unlocked: true },
    });
  } else if (type === 'subscription') {
    await prisma.user.update({
      where: { id: userId },
      data: { tier: 'PREMIUM' },
    });
  }
};

exports.initiateSTKPush = async (req, res) => {
  try {
    const { phoneNumber, phone: phoneAlias, amount, type, matchId } = req.body;
    const phone = phoneNumber || phoneAlias;

    if (!phone || !type) {
      return res.status(400).json({ success: false, error: 'Phone and type required' });
    }

    if (type === 'match_unlock' && !matchId) {
      return res.status(400).json({ success: false, error: 'matchId required for match_unlock' });
    }

    const PRICES = { match_unlock: MATCH_UNLOCK_PRICE, subscription: PREMIUM_SUBSCRIPTION_PRICE, like_viewer: LIKE_VIEWER_PRICE };
    const expectedAmount = PRICES[type];
    if (!expectedAmount) return res.status(400).json({ success: false, error: `Invalid payment type: ${type}` });
    const paymentAmount = amount || expectedAmount;
    if (parseInt(paymentAmount) !== expectedAmount) {
      return res.status(400).json({ success: false, error: `Invalid amount. Expected Ksh ${expectedAmount}` });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId,
        type,
        amount: expectedAmount,
        matchId: matchId ? parseInt(matchId) : null,
        status: 'pending',
      },
    });

    const useRealMpesa = process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET;
    if (useRealMpesa) {
      const formattedPhone = formatPhone(phone);
      const timestamp = mpesaTimestamp();
      const password = mpesaPassword(
        process.env.MPESA_SHORTCODE,
        process.env.MPESA_PASSKEY,
        timestamp
      );

      const result = await Daraja.initiateSTKPush({
        amount: expectedAmount,
        phoneNumber: formattedPhone,
        timestamp,
        password,
        accountReference: type === 'match_unlock' ? `MATCH_${matchId}` : `PREMIUM_${req.userId}`,
        transactionDesc: type === 'match_unlock' ? 'Match Unlock' : 'Moyo Premium',
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
            await processPayment(transaction, type, matchId, req.userId);
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
        res.status(400).json({ success: false, error: result.CustomerMessage || 'M-Pesa request failed' });
      }
    } else {
      console.log(`[MPESA SIMULATION] STK Push sent to ${phone} for Ksh ${expectedAmount} (${type})`);

      setTimeout(async () => {
        try {
          await processPayment(transaction, type, matchId, req.userId);
          console.log(`  → ${type === 'match_unlock' ? `Match ${matchId} unlocked` : `User ${req.userId} upgraded to PREMIUM`}`);
        } catch (err) {
          console.error('Callback processing error:', err);
        }
      }, 3000);

      res.json({
        success: true,
        message: 'STK Push initiated. Please check your phone and enter your M-Pesa PIN.',
        data: { transactionId: transaction.id },
      });
    }
  } catch (error) {
    console.error('STK Push error:', error);
    res.status(500).json({ success: false, error: 'Payment initiation failed' });
  }
};

exports.mpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    if (!Body || !Body.stkCallback) return res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid callback' });

    const { ResultCode, ResultDesc, MerchantRequestID, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;

    if (ResultCode === 0) {
      const receipt = CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value || `CALLBACK${Date.now()}`;

      const transaction = await prisma.transaction.findFirst({
        where: { mpesaReceipt: MerchantRequestID, status: 'pending' },
      });

      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'completed', mpesaReceipt: receipt },
        });

        if (transaction.type === 'match_unlock' && transaction.matchId) {
          await prisma.match.update({
            where: { id: transaction.matchId },
            data: { unlocked: true },
          });
        } else if (transaction.type === 'subscription') {
          await prisma.user.update({
            where: { id: transaction.userId },
            data: { tier: 'PREMIUM' },
          });
        } else if (transaction.type === 'like_viewer') {
          // Just mark completed — frontend checks for completed like_viewer tx
        }
      }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 1, ResultDesc: 'Internal error' });
  }
};

exports.getTransactionHistory = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
};
