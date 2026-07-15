const { prisma, safeJsonParse } = require('../prisma');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const { getIO } = require('../services/socketService');
const { setPushToken, sendPushNotification } = require('../services/notificationService');

const FREE_LIKE_LIMIT = 5;
const FREE_MESSAGE_LIMIT = 3;
const PROFILE_PAGE_SIZE = 50;

function getStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(dateA, dateB) {
  if (!dateA || !dateB) {return false;}
  return getStartOfDay(dateA).getTime() === getStartOfDay(dateB).getTime();
}

const parseId = val => {
  const id = parseInt(val, 10);
  if (isNaN(id)) { throw new AppError('Invalid ID parameter', 400); }
  return id;
};

exports.getProfiles = catchAsync(async (req, res) => {
  const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!currentUser) {
    throw new AppError('User not found', 404);
  }

  const { countyId, minAge, maxAge, gender, page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  const where = {
    id: { not: req.userId },
    isActive: true,
    phoneVerified: true,
  };

  if (gender) {
    if (gender !== 'all') {
      where.gender = gender.toLowerCase();
    }
  } else if (currentUser.interestedIn && currentUser.interestedIn !== 'both') {
    where.gender = currentUser.interestedIn;
  }

  if (minAge) {
    where.age = { ...where.age, gte: parseInt(minAge, 10) };
  }
  if (maxAge) {
    where.age = { ...where.age, lte: parseInt(maxAge, 10) };
  }

  if (countyId) {
    where.countyId = parseInt(countyId, 10);
  } else if (currentUser.tier !== 'PREMIUM') {
    where.countyId = currentUser.countyId;
  }

  const swipedIds = await prisma.swipe.findMany({
    where: { swiperId: req.userId },
    select: { swipedId: true },
  });
  const excludedIds = swipedIds.map(s => s.swipedId);

  const blockedUsers = await prisma.report.findMany({
    where: { reporterId: req.userId, status: 'resolved' },
    select: { reportedId: true },
  });
  blockedUsers.forEach(b => excludedIds.push(b.reportedId));

  const blockedByMe = await prisma.block.findMany({ where: { blockerId: req.userId }, select: { blockedId: true } });
  const blockedMe = await prisma.block.findMany({ where: { blockedId: req.userId }, select: { blockerId: true } });
  const blockedIds = new Set([...blockedByMe.map(b => b.blockedId), ...blockedMe.map(b => b.blockerId)]);
  blockedIds.forEach(id => excludedIds.push(id));

  if (excludedIds.length > 0) {
    where.id = { ...where.id, notIn: excludedIds };
  }

  const [profiles, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
        interestedIn: true,
        countyId: true,
        bio: true,
        occupation: true,
        likes: true,
        hobbies: true,
        photos: true,
        profilePicUrl: true,
        tier: true,
        boostedUntil: true,
        county: { select: { id: true, name: true } },
      },
      orderBy: { boostedUntil: 'desc' },
      skip: (pageNum - 1) * PROFILE_PAGE_SIZE,
      take: PROFILE_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  const now = new Date();
  const myLikes = safeJsonParse(currentUser.likes) || [];
  const myHobbies = safeJsonParse(currentUser.hobbies) || [];

  const parsed = profiles.map(p => ({
    ...p,
    likes: safeJsonParse(p.likes),
    hobbies: safeJsonParse(p.hobbies),
    photos: safeJsonParse(p.photos),
  }));

  parsed.sort((a, b) => {
    const aBoosted = a.boostedUntil && a.boostedUntil > now;
    const bBoosted = b.boostedUntil && b.boostedUntil > now;
    if (aBoosted && !bBoosted) { return -1; }
    if (!aBoosted && bBoosted) { return 1; }

    const aShared = (a.likes || []).filter(l => myLikes.includes(l)).length + (a.hobbies || []).filter(h => myHobbies.includes(h)).length;
    const bShared = (b.likes || []).filter(l => myLikes.includes(l)).length + (b.hobbies || []).filter(h => myHobbies.includes(h)).length;
    return bShared - aShared;
  });

  res.json({
    success: true,
    data: parsed,
    pagination: {
      page: pageNum,
      pageSize: PROFILE_PAGE_SIZE,
      total: totalCount,
      totalPages: Math.ceil(totalCount / PROFILE_PAGE_SIZE),
    },
  });
});

exports.getProfileById = catchAsync(async (req, res) => {
  const userId = parseId(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      interestedIn: true,
      countyId: true,
      bio: true,
      occupation: true,
      likes: true,
      hobbies: true,
      photos: true,
      profilePicUrl: true,
      tier: true,
      county: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  await prisma.profileView.upsert({
    where: { viewerId_viewedId: { viewerId: req.userId, viewedId: parseInt(req.params.id, 10) } },
    update: { createdAt: new Date() },
    create: { viewerId: req.userId, viewedId: parseInt(req.params.id, 10) },
  }).catch(() => {});

  res.json({
    success: true,
    data: {
      ...user,
      likes: safeJsonParse(user.likes),
      hobbies: safeJsonParse(user.hobbies),
      photos: safeJsonParse(user.photos),
    },
  });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { name, age, gender, interestedIn, countyId, bio, occupation, likes, hobbies, photos, profilePicUrl } = req.body;
  const data = {};
  if (name) {
    data.name = name.trim();
  }
  if (age) {
    data.age = parseInt(age, 10);
  }
  if (gender) {
    data.gender = gender.toLowerCase();
  }
  if (interestedIn) {
    data.interestedIn = interestedIn.toLowerCase();
  }
  if (countyId) {
    data.countyId = parseInt(countyId, 10);
  }
  if (bio !== undefined) {
    data.bio = bio;
  }
  if (occupation !== undefined) {
    data.occupation = occupation;
  }
  if (likes) {
    data.likes = JSON.stringify(likes);
  }
  if (hobbies) {
    data.hobbies = JSON.stringify(hobbies);
  }
  if (photos) {
    data.photos = JSON.stringify(photos);
  }
  if (profilePicUrl) {
    data.profilePicUrl = profilePicUrl;
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: {
      id: true,
      name: true,
      age: true,
      gender: true,
      interestedIn: true,
      countyId: true,
      bio: true,
      occupation: true,
      likes: true,
      hobbies: true,
      photos: true,
      profilePicUrl: true,
      tier: true,
      county: { select: { id: true, name: true } },
    },
  });

  res.json({
    success: true,
    data: {
      ...user,
      likes: safeJsonParse(user.likes),
      hobbies: safeJsonParse(user.hobbies),
      photos: safeJsonParse(user.photos),
    },
  });
});

exports.swipe = catchAsync(async (req, res) => {
  const { swipedId, direction } = req.body;

  if (!['like', 'pass', 'superlike'].includes(direction)) {
    throw new AppError('direction must be "like", "pass", or "superlike"', 400);
  }

  if (swipedId === req.userId) {
    throw new AppError('Cannot swipe on yourself', 400);
  }

  const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true, unlimitedChat: true } });
  if (direction === 'like' || direction === 'superlike') {
    if (direction === 'superlike' && currentUser.tier !== 'PREMIUM') {
      throw new AppError('Superlikes are a Premium feature. Upgrade to use them.', 403);
    }
    if (currentUser.tier === 'FREE') {
      const likeCount = await prisma.swipe.count({
        where: { swiperId: req.userId, direction: 'like' },
      });
      if (likeCount >= FREE_LIKE_LIMIT) {
        throw new AppError('Free users get 5 likes. Upgrade to Premium for unlimited likes, or keep browsing.', 403);
      }
    }
  }

  const existing = await prisma.swipe.findUnique({
    where: { swiperId_swipedId: { swiperId: req.userId, swipedId: parseInt(swipedId, 10) } },
  });
  if (existing) {
    throw new AppError('Already swiped on this user', 409);
  }

  await prisma.swipe.create({
    data: { swiperId: req.userId, swipedId: parseInt(swipedId, 10), direction },
  });

  await prisma.userEvent.create({ data: { userId: req.userId, eventType: `swipe_${direction}` } }).catch(() => {});

  let match = null;
  if (direction === 'like' || direction === 'superlike') {
    const mutualLike = await prisma.swipe.findUnique({
      where: { swiperId_swipedId: { swiperId: parseInt(swipedId, 10), swipedId: req.userId } },
    });

    if (mutualLike && (mutualLike.direction === 'like' || mutualLike.direction === 'superlike')) {
      match = await prisma.match.create({
        data: {
          user1Id: Math.min(req.userId, parseInt(swipedId, 10)),
          user2Id: Math.max(req.userId, parseInt(swipedId, 10)),
          unlocked: currentUser.tier === 'PREMIUM' || currentUser.unlimitedChat,
        },
      });
    }
  }

  const likeMessages = { like: 'Liked!', superlike: 'Superliked!', pass: 'Passed!' };

  res.json({
    success: true,
    message: direction === 'like' || direction === 'superlike' ? (match ? "It's a match!" : likeMessages[direction]) : 'Passed!',
    data: match ? { matchId: match.id, unlocked: match.unlocked } : null,
  });
});

exports.getMatches = catchAsync(async (req, res) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { unlimitedChat: true, chatUnlockDate: true },
  });

  const hasDailyUnlock = isSameDay(currentUser?.chatUnlockDate, new Date());
  const isGloballyUnlimited = currentUser?.unlimitedChat || hasDailyUnlock;

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ user1Id: req.userId }, { user2Id: req.userId }],
    },
    include: {
      user1: {
        select: {
          id: true,
          name: true,
          age: true,
          profilePicUrl: true,
          countyId: true,
          tier: true,
          county: { select: { name: true } },
        },
      },
      user2: {
        select: {
          id: true,
          name: true,
          age: true,
          profilePicUrl: true,
          countyId: true,
          tier: true,
          county: { select: { name: true } },
        },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { matchedAt: 'desc' },
  });

  const enriched = matches.map(m => {
    const other = m.user1Id === req.userId ? m.user2 : m.user1;
    const myFreeUsed = m.user1Id === req.userId ? m.user1FreeUsed : m.user2FreeUsed;
    const myLastFreeDate = m.user1Id === req.userId ? m.user1LastFreeDate : m.user2LastFreeDate;
    const effectiveFreeUsed = isSameDay(myLastFreeDate, new Date()) ? myFreeUsed : 0;
    const unlocked = m.unlocked || isGloballyUnlimited;
    const freeRemaining = unlocked ? FREE_MESSAGE_LIMIT : Math.max(0, FREE_MESSAGE_LIMIT - effectiveFreeUsed);
    return {
      id: m.id,
      match: other,
      lastMessage: null,
      messageCount: m._count.messages,
      myFreeUsed: isGloballyUnlimited ? 0 : effectiveFreeUsed,
      freeRemaining,
      unlocked,
      matchedAt: m.matchedAt,
    };
  });

  res.json({ success: true, data: enriched });
});

exports.getMessages = catchAsync(async (req, res) => {
  const matchId = parseId(req.params.matchId);

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new AppError('Match not found', 404);
  }
  if (match.user1Id !== req.userId && match.user2Id !== req.userId) {
    throw new AppError('Not part of this match', 403);
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { unlimitedChat: true, chatUnlockDate: true },
  });

  const isUser1 = match.user1Id === req.userId;
  const myFreeUsed = isUser1 ? match.user1FreeUsed : match.user2FreeUsed;
  const myLastFreeDate = isUser1 ? match.user1LastFreeDate : match.user2LastFreeDate;
  const today = new Date();

  const isDailyUnlocked = isSameDay(currentUser?.chatUnlockDate, today);
  const effectiveFreeUsed = isDailyUnlocked ? 0 : (isSameDay(myLastFreeDate, today) ? myFreeUsed : 0);
  const isUnlocked = match.unlocked || currentUser?.unlimitedChat || isDailyUnlocked;
  const myFreeRemaining = isUnlocked ? FREE_MESSAGE_LIMIT : Math.max(0, FREE_MESSAGE_LIMIT - effectiveFreeUsed);

  const messages = await prisma.message.findMany({
    where: { matchId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      senderId: true,
      content: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      messages,
      quota: {
        myUserId: req.userId,
        myFreeUsed: effectiveFreeUsed,
        myFreeRemaining,
        unlocked: isUnlocked,
        canSend: isUnlocked || effectiveFreeUsed < FREE_MESSAGE_LIMIT,
      },
    },
  });
});

exports.sendMessage = catchAsync(async (req, res) => {
  const matchId = parseId(req.params.matchId);
  const { content } = req.body;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new AppError('Match not found', 404);
  }
  if (match.user1Id !== req.userId && match.user2Id !== req.userId) {
    throw new AppError('Not part of this match', 403);
  }

  const otherUserId = match.user1Id === req.userId ? match.user2Id : match.user1Id;
  const otherUserReports = await prisma.report.count({
    where: { reportedId: otherUserId, status: { in: ['pending', 'reviewed'] } },
  });
  if (otherUserReports >= 3) {
    throw new AppError('This user has been flagged for safety reasons. Messaging is disabled.', 403);
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { unlimitedChat: true, chatUnlockDate: true },
  });

  const isUser1 = match.user1Id === req.userId;
  const freeUsedField = isUser1 ? 'user1FreeUsed' : 'user2FreeUsed';
  const lastFreeDateField = isUser1 ? 'user1LastFreeDate' : 'user2LastFreeDate';
  const freeUsed = isUser1 ? match.user1FreeUsed : match.user2FreeUsed;
  const lastFreeDate = isUser1 ? match.user1LastFreeDate : match.user2LastFreeDate;
  const today = new Date();

  const isDailyUnlocked = isSameDay(currentUser?.chatUnlockDate, today);
  const isUnlocked = match.unlocked || currentUser?.unlimitedChat || isDailyUnlocked;
  let effectiveFreeUsed = freeUsed;

  if (!isUnlocked) {
    if (!isSameDay(lastFreeDate, today)) {
      await prisma.match.update({
        where: { id: matchId },
        data: { [freeUsedField]: 0, [lastFreeDateField]: today },
      });
      effectiveFreeUsed = 0;
    }

    if (effectiveFreeUsed >= FREE_MESSAGE_LIMIT) {
      return res.status(403).json({
        success: false,
        error: 'Free message limit reached. Unlock this match to continue chatting.',
        data: { quotaExceeded: true, matchId },
      });
    }

    await prisma.match.update({
      where: { id: matchId },
      data: { [freeUsedField]: { increment: 1 } },
    });
  }

  const message = await prisma.message.create({
    data: { matchId, senderId: req.userId, content: content.trim() },
  });

  await prisma.userEvent.create({ data: { userId: req.userId, eventType: 'message_sent', metadata: JSON.stringify({ matchId }) } }).catch(() => {});

  const sender = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
  const messageWithSender = { ...message, senderName: sender.name };

  try {
    const io = getIO();
    io.to(`match:${matchId}`).emit('newMessage', messageWithSender);
  } catch (err) {
    logger.warn('Socket emit failed for newMessage:', err.message);
  }

  try {
    await sendPushNotification(otherUserId, sender.name, content, { matchId, type: 'newMessage' });
  } catch (err) {
    logger.warn('Push notification failed:', err.message);
  }

  res.status(201).json({ success: true, data: messageWithSender });
});

exports.reportUser = catchAsync(async (req, res) => {
  const { reportedId, reason, details } = req.body;

  await prisma.report.create({
    data: {
      reporterId: req.userId,
      reportedId: parseInt(reportedId, 10),
      reason,
      details: details || null,
    },
  });

  res.json({ success: true, message: 'Report submitted. We will review it shortly.' });
});

exports.getSafetyStatus = catchAsync(async (req, res) => {
  res.json({
    success: true,
    data: {
      tips: [
        'Meet in public places for the first time',
        'Tell a friend where you are going',
        'Trust your instincts — leave if uncomfortable',
        'Keep your personal financial info private',
        'Report suspicious behavior immediately',
      ],
      emergencyContacts: [
        { name: 'Emergency Services', number: '112' },
        { name: 'Police', number: '999' },
        { name: 'Gender-Based Violence Hotline', number: '1195' },
      ],
    },
  });
});

exports.getLikesSent = catchAsync(async (req, res) => {
  const myLikes = await prisma.swipe.findMany({
    where: { swiperId: req.userId, direction: 'like' },
    select: {
      swipedId: true,
      createdAt: true,
      swiped: {
        select: {
          id: true,
          name: true,
          age: true,
          profilePicUrl: true,
          tier: true,
          county: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const matchPairs = myLikes.length > 0 ? await prisma.match.findMany({
    where: {
      OR: myLikes.map(l => ({
        OR: [
          { user1Id: req.userId, user2Id: l.swipedId },
          { user2Id: req.userId, user1Id: l.swipedId },
        ],
      })),
    },
    select: { id: true, user1Id: true, user2Id: true, unlocked: true, matchedAt: true },
  }) : [];

  const enriched = myLikes.map(l => {
    const m = matchPairs.find(
      mp =>
        (mp.user1Id === req.userId && mp.user2Id === l.swipedId) ||
        (mp.user2Id === req.userId && mp.user1Id === l.swipedId),
    );
    return {
      user: l.swiped,
      likedAt: l.createdAt,
      matched: !!m,
      matchId: m?.id || null,
      unlocked: m?.unlocked || false,
      matchedAt: m?.matchedAt || null,
    };
  });

  res.json({ success: true, data: enriched });
});

exports.getLikesReceived = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true } });
  const isPremium = user.tier === 'PREMIUM';

  const incoming = await prisma.swipe.findMany({
    where: { swipedId: req.userId, direction: 'like' },
    select: {
      id: true,
      swiperId: true,
      createdAt: true,
      swiper: {
        select: {
          id: true,
          name: true,
          age: true,
          profilePicUrl: true,
          tier: true,
          county: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (incoming.length === 0) {
    return res.json({ success: true, data: { likes: [] } });
  }

  const matchPairs = await prisma.match.findMany({
    where: {
      OR: incoming.map(l => ({
        OR: [
          { user1Id: req.userId, user2Id: l.swiperId },
          { user2Id: req.userId, user1Id: l.swiperId },
        ],
      })),
    },
    select: { user1Id: true, user2Id: true },
  });

  const matchedIds = new Set(
    matchPairs.flatMap(m => [m.user1Id, m.user2Id]).filter(id => id !== req.userId),
  );

  const revealedTransactions = await prisma.transaction.findMany({
    where: {
      userId: req.userId,
      type: 'like_unlock',
      status: 'completed',
    },
    select: { matchId: true },
  });
  const revealedLikerIds = new Set(revealedTransactions.map(t => t.matchId).filter(Boolean));

  const likes = incoming
    .filter(l => !matchedIds.has(l.swiperId))
    .map(l => {
      const revealed = isPremium || revealedLikerIds.has(l.swiperId);
      return {
        id: l.id,
        user: revealed
          ? l.swiper
          : { id: l.swiper.id, name: null, age: null, profilePicUrl: null, tier: null, county: null },
        likedAt: l.createdAt,
        revealed,
      };
    });

  res.json({ success: true, data: { likes } });
});

exports.approveLike = catchAsync(async (req, res) => {
  const likerId = parseId(req.params.id);

  const incomingLike = await prisma.swipe.findUnique({
    where: { swiperId_swipedId: { swiperId: likerId, swipedId: req.userId } },
  });
  if (!incomingLike || incomingLike.direction !== 'like') {
    throw new AppError('No like from this user', 404);
  }

  const existingMatch = await prisma.match.findFirst({
    where: { user1Id: Math.min(req.userId, likerId), user2Id: Math.max(req.userId, likerId) },
  });
  if (existingMatch) {
    throw new AppError('Already matched', 409);
  }

  const existingSwipeBack = await prisma.swipe.findUnique({
    where: { swiperId_swipedId: { swiperId: req.userId, swipedId: likerId } },
  });

  const currentUser = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { tier: true, unlimitedChat: true, freeUnlocksRemaining: true },
  });

  if (!existingSwipeBack) {
    if (currentUser.tier === 'FREE') {
      const likeCount = await prisma.swipe.count({
        where: { swiperId: req.userId, direction: 'like' },
      });
      if (likeCount >= FREE_LIKE_LIMIT) {
        throw new AppError('Free users get 5 likes. Upgrade to Premium for unlimited likes.', 403);
      }
    }

    await prisma.swipe.create({
      data: { swiperId: req.userId, swipedId: likerId, direction: 'like' },
    });
  }

  const match = await prisma.match.create({
    data: {
      user1Id: Math.min(req.userId, likerId),
      user2Id: Math.max(req.userId, likerId),
      unlocked: currentUser.tier === 'PREMIUM' || currentUser.unlimitedChat,
    },
  });

  res.json({ success: true, data: { matchId: match.id, unlocked: match.unlocked } });
});

exports.useFreeUnlock = catchAsync(async (req, res) => {
  const likerId = parseId(req.params.id);
  const currentUser = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { freeUnlocksRemaining: true },
  });

  if (!currentUser || currentUser.freeUnlocksRemaining <= 0) {
    throw new AppError('No free unlocks remaining', 403);
  }

  const incomingLike = await prisma.swipe.findUnique({
    where: { swiperId_swipedId: { swiperId: likerId, swipedId: req.userId } },
  });
  if (!incomingLike || incomingLike.direction !== 'like') {
    throw new AppError('No like from this user', 404);
  }

  const existingMatch = await prisma.match.findFirst({
    where: { user1Id: Math.min(req.userId, likerId), user2Id: Math.max(req.userId, likerId) },
  });
  if (existingMatch) {
    throw new AppError('Already matched', 409);
  }

  const existingSwipeBack = await prisma.swipe.findUnique({
    where: { swiperId_swipedId: { swiperId: req.userId, swipedId: likerId } },
  });

  if (!existingSwipeBack) {
    await prisma.swipe.create({ data: { swiperId: req.userId, swipedId: likerId, direction: 'like' } });
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: { freeUnlocksRemaining: { decrement: 1 } },
  });

  const match = await prisma.match.create({
    data: {
      user1Id: Math.min(req.userId, likerId),
      user2Id: Math.max(req.userId, likerId),
      unlocked: true,
    },
  });

  await sendPushNotification(req.userId, "It's a Match! 💕", 'You used a free unlock credit!');
  res.json({ success: true, data: { matchId: match.id, unlocked: true } });
});

exports.dismissLike = catchAsync(async (req, res) => {
  const likerId = parseId(req.params.id);

  await prisma.swipe.deleteMany({
    where: { swiperId: likerId, swipedId: req.userId },
  });

  res.json({ success: true, message: 'Like dismissed' });
});

exports.getProfileViews = catchAsync(async (req, res) => {
  const views = await prisma.profileView.findMany({
    where: { viewedId: req.userId },
    include: { viewer: { select: { id: true, name: true, age: true, profilePicUrl: true, county: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: views.map(v => ({ id: v.id, viewer: v.viewer, viewedAt: v.createdAt })) });
});

exports.boostProfile = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true, boostedUntil: true } });
  if (user.tier !== 'PREMIUM') { throw new AppError('Boosting is a Premium feature', 403); }

  const now = new Date();
  const isAlreadyBoosted = user.boostedUntil && user.boostedUntil > now;
  if (isAlreadyBoosted) { throw new AppError('Profile is already boosted', 409); }

  const boostEnd = new Date(now.getTime() + 30 * 60 * 1000);
  await prisma.user.update({ where: { id: req.userId }, data: { boostedUntil: boostEnd } });
  await prisma.userEvent.create({ data: { userId: req.userId, eventType: 'profile_boosted' } });
  res.json({ success: true, message: 'Profile boosted for 30 minutes', data: { boostedUntil: boostEnd } });
});

exports.deleteAccount = catchAsync(async (req, res) => {
  await prisma.user.update({
    where: { id: req.userId },
    data: { isActive: false },
  });
  res.json({ success: true, message: 'Account deactivated' });
});

exports.updatePushToken = catchAsync(async (req, res) => {
  const { token } = req.body;
  setPushToken(req.userId, token);
  res.json({ success: true, message: 'Push token updated' });
});

exports.blockUser = catchAsync(async (req, res) => {
  const blockedId = parseId(req.params.id);
  if (blockedId === req.userId) throw new AppError('Cannot block yourself', 400);

  const user = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!user) throw new AppError('User not found', 404);

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: req.userId, blockedId } },
  });
  if (existing) throw new AppError('Already blocked', 409);

  await prisma.block.create({ data: { blockerId: req.userId, blockedId } });
  res.json({ success: true, message: 'User blocked' });
});

exports.unblockUser = catchAsync(async (req, res) => {
  const blockedId = parseId(req.params.id);
  await prisma.block.deleteMany({ where: { blockerId: req.userId, blockedId } });
  res.json({ success: true, message: 'User unblocked' });
});

exports.getBlockedUsers = catchAsync(async (req, res) => {
  const blocks = await prisma.block.findMany({
    where: { blockerId: req.userId },
    include: { blocked: { select: { id: true, name: true, profilePicUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: blocks.map(b => ({ id: b.id, user: b.blocked, blockedAt: b.createdAt })) });
});

exports.getSettings = catchAsync(async (req, res) => {
  let settings = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
  if (!settings) {
    settings = await prisma.userSettings.create({ data: { userId: req.userId } });
  }
  res.json({ success: true, data: settings });
});

exports.updateSettings = catchAsync(async (req, res) => {
  const { pushNotifications, matchNotifications, messageNotifications, showAge, showDistance, profileVisible } = req.body;
  const data = {};
  if (pushNotifications !== undefined) data.pushNotifications = !!pushNotifications;
  if (matchNotifications !== undefined) data.matchNotifications = !!matchNotifications;
  if (messageNotifications !== undefined) data.messageNotifications = !!messageNotifications;
  if (showAge !== undefined) data.showAge = !!showAge;
  if (showDistance !== undefined) data.showDistance = !!showDistance;
  if (profileVisible !== undefined) data.profileVisible = !!profileVisible;

  const settings = await prisma.userSettings.upsert({
    where: { userId: req.userId },
    update: data,
    create: { userId: req.userId, ...data },
  });
  res.json({ success: true, data: settings });
});

exports.flagPhoto = catchAsync(async (req, res) => {
  const { reason } = req.body;
  await prisma.user.update({ where: { id: req.userId }, data: { photoModerationStatus: 'flagged' } });
  await prisma.report.create({ data: { reporterId: req.userId, reportedId: req.userId, reason: reason || 'Photo flagged', details: 'Auto-flagged by user' } });
  res.json({ success: true, message: 'Photo flagged for review' });
});

exports.completeOnboarding = catchAsync(async (req, res) => {
  await prisma.user.update({ where: { id: req.userId }, data: { onboardingComplete: true } });
  res.json({ success: true, message: 'Onboarding completed' });
});
