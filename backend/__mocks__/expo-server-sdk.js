const Expo = {
  isExpoPushToken: jest.fn(() => true),
};

const ExpoClient = {
  sendPushNotificationsAsync: jest.fn(() => Promise.resolve([])),
};

module.exports = { Expo, ExpoClient };
