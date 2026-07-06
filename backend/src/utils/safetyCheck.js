const { prisma } = require('../prisma');

exports.checkUserSafety = async userId => {
  const reports = await prisma.report.count({
    where: { reportedId: userId, status: { in: ['pending', 'reviewed'] } },
  });

  const recentSuspicious = await prisma.report.count({
    where: {
      reportedId: userId,
      status: 'pending',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return {
    isFlagged: reports >= 3,
    recentReports: recentSuspicious,
    totalReports: reports,
    requiresReview: reports >= 3 || recentSuspicious >= 2,
  };
};

exports.getBlockedUsers = async userId => {
  const blocks = await prisma.report.findMany({
    where: {
      reporterId: userId,
      status: 'resolved',
    },
    select: {
      reportedId: true,
      reported: {
        select: { id: true, name: true, profilePicUrl: true },
      },
    },
  });
  return blocks.map(b => b.reported);
};

exports.shouldShowSafetyPrompt = async userId => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  const daysSinceRegistration = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  const matches = await prisma.match.count({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
  });

  return {
    showSafetyReminder: daysSinceRegistration <= 7,
    showMeetingSafetyPrompt: matches > 0,
    daysSinceRegistration,
  };
};
