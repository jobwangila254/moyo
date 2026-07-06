jest.mock('express-rate-limit', () => {
  return () => (req, res, next) => next();
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');

const getToken = (overrides = {}) => {
  return jwt.sign(
    { userId: 1, tier: 'PREMIUM', ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
};

describe('Validation Middleware', () => {
  describe('POST /api/auth/register', () => {
    it('rejects empty body', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing phone', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ password: 'Test123!', name: 'Test', age: 25, gender: 'male', countyId: 1 });
      expect(res.status).toBe(400);
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '0712345678', password: '12', name: 'Test', age: 25, gender: 'male', countyId: 1 });
      expect(res.status).toBe(400);
    });

    it('rejects underage user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '0712345678', password: 'Test123!', name: 'Test', age: 15, gender: 'male', countyId: 1 });
      expect(res.status).toBe(400);
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '0712345678', password: 'Test123!', age: 25, gender: 'male', countyId: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects empty login', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });

    it('rejects missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0712345678' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/register - missing gender', () => {
    it('rejects register without gender', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '0712345678', password: 'Test123!', name: 'Test', age: 25, countyId: 1 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/register - missing countyId', () => {
    it('rejects register without countyId', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '0712345678', password: 'Test123!', name: 'Test', age: 25, gender: 'male' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/verify-phone - empty body', () => {
    it('rejects empty verify-phone body', async () => {
      const res = await request(app).post('/api/auth/verify-phone').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/verify-phone - missing code', () => {
    it('rejects verify-phone without code', async () => {
      const res = await request(app)
        .post('/api/auth/verify-phone')
        .send({ phone: '0712345678' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/resend-code - empty body', () => {
    it('rejects empty resend-code body', async () => {
      const res = await request(app).post('/api/auth/resend-code').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/swipe - empty body', () => {
    it('rejects empty swipe body', async () => {
      const token = getToken();
      const res = await request(app)
        .post('/api/users/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/swipe - missing direction', () => {
    it('rejects swipe without direction', async () => {
      const token = getToken();
      const res = await request(app)
        .post('/api/users/swipe')
        .set('Authorization', `Bearer ${token}`)
        .send({ swipedId: 2 });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/users/matches/1/messages - empty body', () => {
    it('rejects empty message body', async () => {
      const token = getToken();
      const res = await request(app)
        .post('/api/users/matches/1/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/users/report - empty body', () => {
    it('rejects empty report body', async () => {
      const token = getToken();
      const res = await request(app)
        .post('/api/users/report')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/payments/stk-push - empty body', () => {
    it('rejects stk-push without auth', async () => {
      const res = await request(app)
        .post('/api/payments/stk-push')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password - empty body', () => {
    it('rejects empty forgot-password body', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password - empty body', () => {
    it('rejects empty reset-password body', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password - short code', () => {
    it('rejects reset-password with short code', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ phone: '0712345678', code: '123', password: 'NewPass123!' });
      expect(res.status).toBe(400);
    });
  });
});
