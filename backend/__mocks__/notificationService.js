const pushTokens = new Map();

module.exports = {
  setPushToken: jest.fn((userId, token) => {
    pushTokens.set(userId, token);
  }),
  getPushToken: jest.fn(userId => pushTokens.get(userId)),
  sendPushNotification: jest.fn(() => Promise.resolve()),
};
