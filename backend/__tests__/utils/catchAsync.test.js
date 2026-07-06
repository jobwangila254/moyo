const catchAsync = require('../../src/utils/catchAsync');

describe('catchAsync', () => {
  it('calls next with error when async fn rejects', async () => {
    const error = new Error('Boom');
    const fn = catchAsync(async () => { throw error; });
    const next = jest.fn();

    await fn(null, null, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('passes through successful execution', async () => {
    const req = {};
    const res = { json: jest.fn() };
    const fn = catchAsync(async (r, s) => {
      s.json({ ok: true });
    });
    const next = jest.fn();

    await fn(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });
});
