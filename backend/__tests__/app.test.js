const request = require('supertest');
const app = require('../src/server');

describe('App', () => {
  describe('GET /api/health', () => {
    it('returns health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Moyo API is running/);
    });

    it('returns environment info', async () => {
      const res = await request(app).get('/api/health');
      expect(res.body).toHaveProperty('environment');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/nonexistent', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('has rate limit headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers).toHaveProperty('x-ratelimit-limit');
    });
  });
});
