jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
}));

const { AppError, notFound, errorHandler } = require('../../src/middleware/errorHandler');

describe('AppError', () => {
  it('creates an operational error with status code', () => {
    const err = new AppError('Test error', 400);
    expect(err.message).toBe('Test error');
    expect(err.statusCode).toBe(400);
    expect(err.isOperational).toBe(true);
  });

  it('defaults to 500 for unknown errors', () => {
    const err = new AppError('Server error');
    expect(err.message).toBe('Server error');
    expect(err.statusCode).toBe(undefined);
  });
});

describe('errorHandler', () => {
  let req, res;

  beforeEach(() => {
    req = { originalUrl: '/test', method: 'GET' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('handles AppError with correct status', () => {
    const err = new AppError('Not found', 404);
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Not found' }),
    );
  });

  it('defaults to 500 for unknown errors', () => {
    const err = new Error('Boom');
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('handles JWT errors', () => {
    const err = { name: 'JsonWebTokenError', message: 'invalid' };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid token. Please log in again.' }),
    );
  });

  it('handles expired token', () => {
    const err = { name: 'TokenExpiredError', message: 'expired' };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Token expired. Please log in again.' }),
    );
  });

  it('handles Prisma P2002 unique constraint', () => {
    const err = { code: 'P2002', name: 'PrismaError' };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'A record with this value already exists.' }),
    );
  });

  it('handles Prisma P2025 not found', () => {
    const err = { code: 'P2025', name: 'PrismaError' };
    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('shows stack trace in development mode', () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new AppError('Test', 400);
    errorHandler(err, req, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ stack: expect.any(String) }),
    );
    process.env.NODE_ENV = oldEnv;
  });
});

describe('notFound', () => {
  it('passes AppError to next', () => {
    const next = jest.fn();
    const req = { originalUrl: '/bad' };
    notFound(req, null, next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });
});
