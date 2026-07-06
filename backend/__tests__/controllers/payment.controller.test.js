jest.mock('../../src/prisma', () => ({
  prisma: {
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    match: { update: jest.fn(), updateMany: jest.fn() },
    user: { update: jest.fn() },
  },
}));

jest.mock('../../src/config/mpesa.config', () => ({
  Daraja: {
    initiateSTKPush: jest.fn(),
    queryStatus: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const { prisma } = require('../../src/prisma');
const paymentController = require('../../src/controllers/payment.controller');

describe('Payment Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, params: {}, userId: 1 };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getTransactionStatus', () => {
    it('returns transaction when found and owned', async () => {
      req.params.transactionId = '1';
      prisma.transaction.findUnique.mockResolvedValue({
        id: 1, userId: 1, type: 'subscription', amount: 500, status: 'completed',
      });

      await paymentController.getTransactionStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('returns 404 for missing transaction', async () => {
      req.params.transactionId = '999';
      prisma.transaction.findUnique.mockResolvedValue(null);

      await paymentController.getTransactionStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    it('returns 403 for unowned transaction', async () => {
      req.params.transactionId = '2';
      prisma.transaction.findUnique.mockResolvedValue({ id: 2, userId: 99 });

      await paymentController.getTransactionStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 }),
      );
    });
  });

  describe('getTransactionHistory', () => {
    it('returns transaction list', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { id: 1, userId: 1, type: 'subscription', amount: 500, status: 'completed' },
      ]);

      await paymentController.getTransactionHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Array) }),
      );
    });
  });

  describe('initiateSTKPush - simulated', () => {
    it('initiates STK push in simulated mode', async () => {
      req.body = { phoneNumber: '0712345678', type: 'subscription_monthly' };
      prisma.transaction.create.mockResolvedValue({ id: 1, userId: 1, type: 'subscription_monthly', amount: 500, status: 'pending' });

      await paymentController.initiateSTKPush(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('initiateSTKPush - match_unlock invalid', () => {
    it('rejects match_unlock without matchId', async () => {
      req.body = { phoneNumber: '0712345678', type: 'match_unlock' };

      await paymentController.initiateSTKPush(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe('mpesaCallback', () => {
    it('processes successful callback', async () => {
      req.body = {
        Body: {
          stkCallback: {
            ResultCode: 0,
            MerchantRequestID: 'ABC123',
            CallbackMetadata: {
              Item: [{ Name: 'MpesaReceiptNumber', Value: 'LER123' }],
            },
          },
        },
      };
      prisma.transaction.findFirst.mockResolvedValue({ id: 1, userId: 1, type: 'subscription', amount: 500, status: 'pending', matchId: null });
      prisma.transaction.findUnique.mockResolvedValue({ id: 1, userId: 1, type: 'subscription', amount: 500, status: 'pending' });

      await paymentController.mpesaCallback(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ ResultCode: 0, ResultDesc: 'Success' }),
      );
    });
  });
});
