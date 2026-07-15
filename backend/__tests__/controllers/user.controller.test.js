jest.mock('../../src/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    swipe: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    match: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    report: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  safeJsonParse: jest.fn(val => {
    if (!val || val === '[]') {return [];}
    try { return JSON.parse(val); } catch { return []; }
  }),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { prisma } = require('../../src/prisma');
const userController = require('../../src/controllers/user.controller');

describe('User Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      userId: 1,
      user: { id: 1, tier: 'FREE' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('getProfiles', () => {
    it('returns profiles with pagination', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        interestedIn: 'female',
        countyId: 1,
        tier: 'FREE',
      });
      prisma.swipe.findMany.mockResolvedValue([]);
      prisma.report.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        { id: 2, name: 'Jane', age: 25, gender: 'female', likes: '[]', hobbies: '[]', photos: '[]', county: { id: 1, name: 'Nairobi' } },
      ]);
      prisma.user.count.mockResolvedValue(1);

      await userController.getProfiles(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            total: 1,
          }),
        }),
      );
    });
  });

  describe('getProfileById', () => {
    it('returns profile when found', async () => {
      req.params.id = '2';
      prisma.user.findUnique.mockResolvedValue({
        id: 2, name: 'Jane', age: 25, gender: 'female', likes: '[]', hobbies: '[]', photos: '[]',
        county: { id: 1, name: 'Nairobi' },
      });

      await userController.getProfileById(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('returns 404 when user not found', async () => {
      req.params.id = '999';
      prisma.user.findUnique.mockResolvedValue(null);

      await userController.getProfileById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    it('rejects invalid id parameter', async () => {
      req.params.id = 'abc';

      await userController.getProfileById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  describe('updateProfile', () => {
    it('updates profile successfully', async () => {
      req.body = { name: 'Updated Name', bio: 'New bio' };
      prisma.user.update.mockResolvedValue({
        id: 1, name: 'Updated Name', age: 25, bio: 'New bio', likes: '[]', hobbies: '[]', photos: '[]',
        county: { id: 1, name: 'Nairobi' },
      });

      await userController.updateProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('swipe', () => {
    beforeEach(() => {
      req.body = { swipedId: 2, direction: 'like' };
    });

    it('creates a like swipe', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, tier: 'PREMIUM' });
      prisma.swipe.findUnique.mockResolvedValue(null);
      prisma.swipe.create.mockResolvedValue({ id: 1, swiperId: 1, swipedId: 2, direction: 'like' });

      await userController.swipe(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('rejects swipe on yourself', async () => {
      req.body.swipedId = 1;

      await userController.swipe(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: 'Cannot swipe on yourself' }),
      );
    });

    it('rejects duplicate swipe', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, tier: 'PREMIUM' });
      prisma.swipe.findUnique.mockResolvedValue({ id: 1, swiperId: 1, swipedId: 2 });

      await userController.swipe(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 409 }),
      );
    });

    it('rejects superlike for free users', async () => {
      req.body = { swipedId: 2, direction: 'superlike' };
      prisma.user.findUnique.mockResolvedValue({ id: 1, tier: 'FREE' });

      await userController.swipe(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 }),
      );
    });
  });

  describe('getMatches', () => {
    it('returns matches list', async () => {
      prisma.match.findMany.mockResolvedValue([
        {
          id: 1, user1Id: 1, user2Id: 2, unlocked: false,
          user1FreeUsed: 0, user2FreeUsed: 1,
          matchedAt: new Date(),
          user1: { id: 1, name: 'Me' },
          user2: { id: 2, name: 'Jane', age: 25, county: { name: 'Nairobi' } },
          _count: { messages: 3 },
        },
      ]);

      await userController.getMatches(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Array) }),
      );
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      req.params.matchId = '1';
      req.body = { content: 'Hello!' };
    });

    it('sends a message successfully', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 1, user1Id: 1, user2Id: 2, unlocked: true, user1FreeUsed: 0, user2FreeUsed: 0,
      });
      prisma.report.count.mockResolvedValue(0);
      prisma.message.create.mockResolvedValue({ id: 1, matchId: 1, senderId: 1, content: 'Hello!' });
      prisma.user.findUnique.mockResolvedValue({ name: 'Me' });

      await userController.sendMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('rejects message when not part of match', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 1, user1Id: 3, user2Id: 4,
      });

      await userController.sendMessage(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 }),
      );
    });
  });

  describe('reportUser', () => {
    it('submits a report', async () => {
      req.body = { reportedId: 2, reason: 'Spam' };
      prisma.report.create.mockResolvedValue({ id: 1 });

      await userController.reportUser(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('deleteAccount', () => {
    it('deactivates account', async () => {
      prisma.user.update.mockResolvedValue({});

      await userController.deleteAccount(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('getLikesSent', () => {
    it('returns likes sent with match info', async () => {
      prisma.swipe.findMany.mockResolvedValue([
        {
          swipedId: 2,
          createdAt: new Date(),
          swiped: { id: 2, name: 'Jane', age: 25, profilePicUrl: null, tier: 'FREE', county: { name: 'Nairobi' } },
        },
      ]);
      prisma.match.findMany.mockResolvedValue([
        { id: 1, user1Id: 1, user2Id: 2, unlocked: false, matchedAt: new Date() },
      ]);

      await userController.getLikesSent(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Array) }),
      );
    });
  });

  describe('getLikesReceived', () => {
    it('returns likes received for premium user', async () => {
      prisma.user.findUnique.mockResolvedValue({ tier: 'PREMIUM' });
      prisma.swipe.findMany.mockResolvedValueOnce([
        {
          id: 1, swiperId: 2, createdAt: new Date(),
          swiper: { id: 2, name: 'Jane', age: 25, profilePicUrl: null, tier: 'FREE', county: { name: 'Nairobi' } },
        },
      ]);
      prisma.match.findMany.mockResolvedValue([]);
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.swipe.findMany.mockResolvedValueOnce([]);

      await userController.getLikesReceived(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('approveLike', () => {
    it('approves an incoming like and creates match', async () => {
      req.params.id = '2';
      prisma.swipe.findUnique.mockResolvedValueOnce({ direction: 'like' });
      prisma.match.findFirst.mockResolvedValue(null);
      prisma.swipe.findUnique.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValue({ tier: 'PREMIUM' });
      prisma.swipe.create.mockResolvedValue({ id: 2, swiperId: 1, swipedId: 2, direction: 'like' });
      prisma.match.create.mockResolvedValue({ id: 1, unlocked: true });

      await userController.approveLike(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('dismissLike', () => {
    it('dismisses an incoming like', async () => {
      req.params.id = '2';
      prisma.swipe.deleteMany.mockResolvedValue({ count: 1 });

      await userController.dismissLike(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('getMessages', () => {
    it('returns messages with quota', async () => {
      req.params.matchId = '1';
      prisma.match.findUnique.mockResolvedValue({
        id: 1, user1Id: 1, user2Id: 2, unlocked: true, user1FreeUsed: 0, user2FreeUsed: 0,
      });
      prisma.message.findMany.mockResolvedValue([
        { id: 1, senderId: 1, content: 'Hello', createdAt: new Date() },
      ]);

      await userController.getMessages(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            messages: expect.any(Array),
            quota: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('getSafetyStatus', () => {
    it('returns safety tips and emergency contacts', async () => {
      await userController.getSafetyStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tips: expect.any(Array),
            emergencyContacts: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('updatePushToken', () => {
    it('updates the push token', async () => {
      req.body = { token: 'expo-token-123' };

      await userController.updatePushToken(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });
});
