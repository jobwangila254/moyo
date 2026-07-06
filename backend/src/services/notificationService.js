const { Expo } = require('expo-server-sdk');
const logger = require('../utils/logger');

const pushTokens = new Map();

const expo = new Expo();

function setPushToken(userId, token) {
  if (token) {
    pushTokens.set(userId, token);
  } else {
    pushTokens.delete(userId);
  }
}

function getPushToken(userId) {
  return pushTokens.get(userId);
}

async function sendPushNotification(userId, title, body, data = {}) {
  const pushToken = pushTokens.get(userId);
  if (!pushToken) {
    logger.debug(`No push token for user ${userId}`);
    return;
  }

  if (!Expo.isExpoPushToken(pushToken)) {
    logger.error(`Invalid Expo push token for user ${userId}: ${pushToken}`);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    logger.info(`Push notification sent to user ${userId}: ${JSON.stringify(tickets)}`);
  } catch (error) {
    logger.error(`Failed to send push notification to user ${userId}: ${error.message}`);
  }
}

module.exports = { setPushToken, getPushToken, sendPushNotification };
