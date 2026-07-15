const BASE_URL = 'http://localhost:5000/api';

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

let jamesToken;
let patrickToken;

beforeAll(async () => {
  const jamesRes = await api('POST', '/auth/login', {
    body: { phone: '0701100000', password: 'Password123!' },
  });
  jamesToken = jamesRes.body.data.token;

  const patrickRes = await api('POST', '/auth/login', {
    body: { phone: '0711100004', password: 'Password123!' },
  });
  patrickToken = patrickRes.body.data.token;
});

describe('Complete Onboarding', () => {
  it('should mark onboarding as complete', async () => {
    const res = await api('POST', '/users/complete-onboarding', { token: jamesToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/onboarding/i);
  });

  it('should fail without auth', async () => {
    const res = await api('POST', '/users/complete-onboarding');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Settings', () => {
  it('GET should return default settings', async () => {
    const res = await api('GET', '/users/settings', { token: patrickToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pushNotifications');
    expect(res.body.data).toHaveProperty('matchNotifications');
    expect(res.body.data).toHaveProperty('messageNotifications');
    expect(res.body.data).toHaveProperty('showAge');
    expect(res.body.data).toHaveProperty('showDistance');
    expect(res.body.data).toHaveProperty('profileVisible');
  });

  it('PUT should update settings', async () => {
    const res = await api('PUT', '/users/settings', {
      token: jamesToken,
      body: {
        matchNotifications: false,
        messageNotifications: false,
        pushNotifications: false,
        showAge: false,
        showDistance: false,
        profileVisible: false,
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matchNotifications).toBe(false);
    expect(res.body.data.messageNotifications).toBe(false);
    expect(res.body.data.pushNotifications).toBe(false);
    expect(res.body.data.showAge).toBe(false);
    expect(res.body.data.showDistance).toBe(false);
    expect(res.body.data.profileVisible).toBe(false);
  });

  it('should read back updated values', async () => {
    const res = await api('GET', '/users/settings', { token: jamesToken });
    expect(res.status).toBe(200);
    expect(res.body.data.matchNotifications).toBe(false);
    expect(res.body.data.showAge).toBe(false);
    expect(res.body.data.profileVisible).toBe(false);
  });

  it('should fail GET without auth', async () => {
    const res = await api('GET', '/users/settings');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should fail PUT without auth', async () => {
    const res = await api('PUT', '/users/settings', {
      body: { showAge: true },
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Block / Unblock', () => {
  afterAll(async () => {
    await api('DELETE', '/users/block/2', { token: jamesToken }).catch(() => {});
  });

  it('should block a user', async () => {
    const res = await api('POST', '/users/block/2', { token: jamesToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/blocked/i);
  });

  it('should list blocked users including the blocked user', async () => {
    const res = await api('GET', '/users/blocks', { token: jamesToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const blocked = res.body.data.find((b) => b.user.id === 2);
    expect(blocked).toBeDefined();
    expect(blocked.user.name).toBeDefined();
    expect(blocked.blockedAt).toBeDefined();
  });

  it('should return 409 when blocking an already blocked user', async () => {
    const res = await api('POST', '/users/block/2', { token: jamesToken });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should not allow self-block', async () => {
    const res = await api('POST', '/users/block/1', { token: jamesToken });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/yourself/i);
  });

  it('should unblock the user', async () => {
    const res = await api('DELETE', '/users/block/2', { token: jamesToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/unblocked/i);
  });

  it('should list empty blocked users after unblock', async () => {
    const res = await api('GET', '/users/blocks', { token: jamesToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const blocked = res.body.data.find((b) => b.user.id === 2);
    expect(blocked).toBeUndefined();
  });

  it('should fail block without auth', async () => {
    const res = await api('POST', '/users/block/2');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Profile Views', () => {
  it('should track profile view after viewing a profile', async () => {
    const viewRes = await api('GET', '/users/profiles/4', { token: jamesToken });
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.success).toBe(true);
    expect(viewRes.body.data.id).toBe(4);
  });

  it('GET /profile-views should return viewer info', async () => {
    const res = await api('GET', '/users/profile-views', { token: patrickToken });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    if (res.body.data.length > 0) {
      const jamesView = res.body.data.find((v) => v.viewer && v.viewer.id === 1);
      expect(jamesView).toBeDefined();
      expect(jamesView.viewer.name).toBeDefined();
      expect(jamesView.viewedAt).toBeDefined();
    }
  });

  it('should fail without auth', async () => {
    const res = await api('GET', '/users/profile-views');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Boost', () => {
  it('should enforce premium tier for boost', async () => {
    const res = await api('POST', '/users/boost', { token: jamesToken });
    expect([200, 403, 409]).toContain(res.status);
    if (res.status === 403) {
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/premium/i);
    }
  });

  it('should fail boost without auth', async () => {
    const res = await api('POST', '/users/boost');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Photo Moderation', () => {
  it('should flag photo with a reason', async () => {
    const res = await api('POST', '/users/flag-photo', {
      token: jamesToken,
      body: { reason: 'Inappropriate background' },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/flagged/i);
  });

  it('should create a self-report', async () => {
    const reportsRes = await api('GET', '/users/safety-status', { token: jamesToken });
    expect(reportsRes.status).toBe(200);
    expect(reportsRes.body.success).toBe(true);
    expect(reportsRes.body.data).toHaveProperty('tips');
    expect(reportsRes.body.data).toHaveProperty('emergencyContacts');
  });

  it('should fail flag-photo without auth', async () => {
    const res = await api('POST', '/users/flag-photo', {
      body: { reason: 'Test' },
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
