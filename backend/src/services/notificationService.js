const { Expo } = require('expo-server-sdk');
const logger = require('../utils/logger');
const { prisma } = require('../prisma');

const expo = new Expo();

async function setPushToken(userId, token) {
  if (token) {
    await prisma.user.update({ where: { id: userId }, data: { pushToken: token } }).catch(err => {
      logger.error(`Failed to store push token for user ${userId}: ${err.message}`);
    });
  }
}

async function getPushToken(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } }).catch(() => null);
  return user?.pushToken || null;
}

async function sendPushNotification(userId, title, body, data = {}) {
  const pushToken = await getPushToken(userId);
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
