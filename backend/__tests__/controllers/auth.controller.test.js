jest.setTimeout(30000);

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  county: {
    findUnique: jest.fn(),
  },
};

jest.mock('../../src/prisma', () => ({
  prisma: mockPrisma,
  safeJsonParse: jest.fn(val => {
    if (!val || val === '[]') {return [];}
    try { return JSON.parse(val); } catch { return []; }
  }),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const { register, verifyPhone, resendCode, login, getMe, forgotPassword, resetPassword } = require('../../src/controllers/auth.controller');

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, userId: 1, user: { id: 1, tier: 'FREE' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      req.body = {
        phone: '0712345678',
        password: 'Test123!',
        name: 'Test User',
        age: 25,
        gender: 'male',
        countyId: '1',
      };
    });

    it('returns 201 on successful registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.county.findUnique.mockResolvedValue({ id: 1, name: 'Nairobi' });
      mockPrisma.user.create.mockResolvedValue({ id: 1, phone: '0712345678', name: 'Test User' });

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('returns 409 if phone already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, phone: '0712345678' });

      await register(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 409 }),
      );
    });

    it('rejects invalid phone number', async () => {
      req.body.phone = '123';
      await register(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('verifyPhone', () => {
    beforeEach(() => {
      req.body = { phone: '0712345678', code: '123456' };
    });

    it('verifies phone and returns token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', phoneVerified: false,
        phoneVerificationCode: '123456', tier: 'FREE',
        name: 'Test', countyId: 1, age: 25, gender: 'male',
      });

      await verifyPhone(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ token: expect.any(String) }),
        }),
      );
    });

    it('returns 400 if user not found or already verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await verifyPhone(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('returns 400 if already verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', phoneVerified: true,
      });
      await verifyPhone(req, res, next);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe('resendCode', () => {
    it('resends verification code', async () => {
      req.body = { phone: '0712345678' };
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', phoneVerified: false,
      });

      await resendCode(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('returns 400 if user not found', async () => {
      req.body = { phone: '0712345678' };
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await resendCode(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('login', () => {
    beforeEach(() => {
      req.body = { phone: '0712345678', password: 'Test123!' };
    });

    it('logs in with valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('Test123!', 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', passwordHash: hash, phoneVerified: true,
        tier: 'FREE', name: 'Test', age: 25, gender: 'male',
        interestedIn: 'both', countyId: 1, profilePicUrl: 'https://example.com/pic.jpg',
      });
      mockPrisma.county.findUnique.mockResolvedValue({ id: 1, name: 'Nairobi' });

      await login(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ token: expect.any(String) }),
        }),
      );
    });

    it('returns 403 if phone not verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', passwordHash: 'hash', phoneVerified: false,
      });

      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('returns 401 with wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678',
        passwordHash: 'invalidhashdummytextforbcryptcomparison',
        phoneVerified: true,
      });

      await login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });

  describe('getMe', () => {
    it('returns user profile when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', name: 'Test', age: 25, gender: 'male',
        interestedIn: 'both', countyId: 1, bio: 'Hello', occupation: 'Engineer',
        likes: '["Music"]', hobbies: '["Hiking"]', photos: '[]',
        profilePicUrl: 'https://example.com/pic.jpg', phoneVerified: true, tier: 'FREE',
        county: { id: 1, name: 'Nairobi' }, createdAt: new Date(),
        _count: { matchesAsUser1: 2, matchesAsUser2: 1 },
      });

      await getMe(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ name: 'Test' }) }),
      );
    });

    it('returns 404 if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('forgotPassword', () => {
    it('sends reset code when user exists', async () => {
      req.body = { phone: '0712345678' };
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, phone: '0712345678' });
      mockPrisma.user.update.mockResolvedValue({});

      await forgotPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('forgotPassword - not found still returns success', () => {
    it('returns success even if phone not found', async () => {
      req.body = { phone: '0712345678' };
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await forgotPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('resetPassword', () => {
    it('resets password with valid code', async () => {
      req.body = { phone: '0712345678', code: '123456', password: 'NewPass123!' };
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', phoneVerificationCode: '123456',
      });
      mockPrisma.user.update.mockResolvedValue({});

      await resetPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('resetPassword - invalid code', () => {
    it('rejects invalid reset code', async () => {
      req.body = { phone: '0712345678', code: '000000', password: 'NewPass123!' };
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, phone: '0712345678', phoneVerificationCode: '123456',
      });

      await resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });
});
