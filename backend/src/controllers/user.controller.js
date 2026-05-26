const { prisma, safeJsonParse } = require('../prisma');

exports.getProfiles = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!currentUser) return res.status(404).json({ success: false, error: 'User not found' });

    const { countyId, minAge, maxAge, gender } = req.query;

    const where = {
      id: { not: req.userId },
      isActive: true,
      phoneVerified: true,
    };

    if (gender) {
      if (gender !== 'all') where.gender = gender.toLowerCase();
    } else if (currentUser.interestedIn && currentUser.interestedIn !== 'both') {
      where.gender = currentUser.interestedIn;
    }

    if (minAge) where.age = { ...where.age, gte: parseInt(minAge) };
    if (maxAge) where.age = { ...where.age, lte: parseInt(maxAge) };

    if (countyId) {
      where.countyId = parseInt(countyId);
    } else if (currentUser.tier !== 'PREMIUM') {
      where.countyId = currentUser.countyId;
    }

    const swipedIds = await prisma.swipe.findMany({
      where: { swiperId: req.userId },
      select: { swipedId: true },
    });
    const excludedIds = swipedIds.map(s => s.swipedId);
    if (excludedIds.length > 0) {
      where.id = { ...where.id, notIn: excludedIds };
    }

    const profiles = await prisma.user.findMany({
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
        county: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const parsed = profiles.map(p => ({
      ...p,
      likes: safeJsonParse(p.likes),
      hobbies: safeJsonParse(p.hobbies),
      photos: safeJsonParse(p.photos),
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profiles' });
  }
};

exports.getProfileById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });

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

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({ success: true, data: { ...user, likes: safeJsonParse(user.likes), hobbies: safeJsonParse(user.hobbies), photos: safeJsonParse(user.photos) } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, age, gender, interestedIn, countyId, bio, occupation, likes, hobbies, photos, profilePicUrl } = req.body;
    const data = {};
    if (name) data.name = name.trim();
    if (age) data.age = parseInt(age);
    if (gender) data.gender = gender.toLowerCase();
    if (interestedIn) data.interestedIn = interestedIn.toLowerCase();
    if (countyId) data.countyId = parseInt(countyId);
    if (bio !== undefined) data.bio = bio;
    if (occupation !== undefined) data.occupation = occupation;
    if (likes) data.likes = JSON.stringify(likes);
    if (hobbies) data.hobbies = JSON.stringify(hobbies);
    if (photos) data.photos = JSON.stringify(photos);
    if (profilePicUrl) data.profilePicUrl = profilePicUrl;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: {
        id: true, name: true, age: true, gender: true, interestedIn: true, countyId: true,
        bio: true, occupation: true, likes: true, hobbies: true, photos: true, profilePicUrl: true, tier: true,
        county: { select: { id: true, name: true } },
      },
    });

    res.json({ success: true, data: { ...user, likes: safeJsonParse(user.likes), hobbies: safeJsonParse(user.hobbies), photos: safeJsonParse(user.photos) } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
};

exports.swipe = async (req, res) => {
  try {
    const { swipedId, direction } = req.body;

    if (!swipedId || !direction) {
      return res.status(400).json({ success: false, error: 'swipedId and direction required' });
    }

    if (!['like', 'pass'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'direction must be "like" or "pass"' });
    }

    if (swipedId === req.userId) {
      return res.status(400).json({ success: false, error: 'Cannot swipe on yourself' });
    }

    if (direction === 'like') {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true } });
      if (user.tier === 'FREE') {
        const likeCount = await prisma.swipe.count({
          where: { swiperId: req.userId, direction: 'like' },
        });
        if (likeCount >= 5) {
          return res.status(403).json({
            success: false,
            error: 'Free users get 5 likes. Upgrade to Premium for unlimited likes, or keep browsing.',
          });
        }
      }
    }

    const existing = await prisma.swipe.findUnique({
      where: { swiperId_swipedId: { swiperId: req.userId, swipedId: parseInt(swipedId) } },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Already swiped on this user' });
    }

    await prisma.swipe.create({
      data: { swiperId: req.userId, swipedId: parseInt(swipedId), direction },
    });

    let match = null;
    if (direction === 'like') {
      const mutualLike = await prisma.swipe.findUnique({
        where: { swiperId_swipedId: { swiperId: parseInt(swipedId), swipedId: req.userId } },
      });

      if (mutualLike && mutualLike.direction === 'like') {
        const otherUser = await prisma.user.findUnique({ where: { id: parseInt(swipedId) }, select: { tier: true } });
        const bothPremium = user.tier === 'PREMIUM' && otherUser.tier === 'PREMIUM';
        match = await prisma.match.create({
          data: {
            user1Id: Math.min(req.userId, parseInt(swipedId)),
            user2Id: Math.max(req.userId, parseInt(swipedId)),
            unlocked: bothPremium,
          },
        });
      }
    }

    res.json({
      success: true,
      message: direction === 'like' ? (match ? 'It\'s a match!' : 'Liked!') : 'Passed!',
      data: match ? { matchId: match.id, unlocked: match.unlocked } : null,
    });
  } catch (error) {
    console.error('Swipe error:', error);
    res.status(500).json({ success: false, error: 'Swipe failed' });
  }
};

exports.getMatches = async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: req.userId }, { user2Id: req.userId }],
      },
      include: {
        user1: { select: { id: true, name: true, age: true, profilePicUrl: true, countyId: true, tier: true, county: { select: { name: true } } } },
        user2: { select: { id: true, name: true, age: true, profilePicUrl: true, countyId: true, tier: true, county: { select: { name: true } } } },
        _count: { select: { messages: true } },
      },
      orderBy: { matchedAt: 'desc' },
    });

    const enriched = matches.map(m => {
      const other = m.user1Id === req.userId ? m.user2 : m.user1;
      const myFreeUsed = m.user1Id === req.userId ? m.user1FreeUsed : m.user2FreeUsed;
      const freeRemaining = Math.max(0, 5 - myFreeUsed);
      return {
        id: m.id,
        match: other,
        lastMessage: null,
        messageCount: m._count.messages,
        myFreeUsed,
        freeRemaining,
        unlocked: m.unlocked,
        matchedAt: m.matchedAt,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch matches' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    if (isNaN(matchId)) return res.status(400).json({ success: false, error: 'Invalid match ID' });

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });
    if (match.user1Id !== req.userId && match.user2Id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Not part of this match' });
    }

    const myFreeUsed = match.user1Id === req.userId ? match.user1FreeUsed : match.user2FreeUsed;
    const otherFreeUsed = match.user1Id === req.userId ? match.user2FreeUsed : match.user1FreeUsed;

    const messages = await prisma.message.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, senderId: true, content: true, createdAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        messages,
        quota: {
          myUserId: req.userId,
          myFreeUsed,
          myFreeRemaining: Math.max(0, 5 - myFreeUsed),
          unlocked: match.unlocked,
          canSend: match.unlocked || myFreeUsed < 5,
        },
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content required' });
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });
    if (match.user1Id !== req.userId && match.user2Id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Not part of this match' });
    }

    const isUser1 = match.user1Id === req.userId;
    const freeUsed = isUser1 ? match.user1FreeUsed : match.user2FreeUsed;

    if (!match.unlocked && freeUsed >= 5) {
      return res.status(403).json({
        success: false,
        error: 'Free message limit reached. Unlock this match to continue chatting.',
        data: { quotaExceeded: true, matchId },
      });
    }

    const message = await prisma.message.create({
      data: { matchId, senderId: req.userId, content: content.trim() },
    });

    const sender = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } });
    const messageWithSender = { ...message, senderName: sender.name };

    if (!match.unlocked) {
      const updateField = isUser1 ? 'user1FreeUsed' : 'user2FreeUsed';
      await prisma.match.update({
        where: { id: matchId },
        data: { [updateField]: { increment: 1 } },
      });
    }

    res.status(201).json({ success: true, data: messageWithSender });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
};

exports.reportUser = async (req, res) => {
  try {
    const { reportedId, reason, details } = req.body;
    if (!reportedId || !reason) {
      return res.status(400).json({ success: false, error: 'reportedId and reason required' });
    }

    await prisma.report.create({
      data: {
        reporterId: req.userId,
        reportedId: parseInt(reportedId),
        reason,
        details: details || null,
      },
    });

    res.json({ success: true, message: 'Report submitted. We will review it shortly.' });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
};

exports.getSafetyStatus = async (req, res) => {
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
};

exports.getLikesSent = async (req, res) => {
  try {
    const myLikes = await prisma.swipe.findMany({
      where: { swiperId: req.userId, direction: 'like' },
      select: {
        swipedId: true,
        createdAt: true,
        swiped: {
          select: {
            id: true, name: true, age: true, profilePicUrl: true, tier: true,
            county: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const matchPairs = await prisma.match.findMany({
      where: {
        OR: myLikes.map(l => ({
          OR: [
            { user1Id: req.userId, user2Id: l.swipedId },
            { user2Id: req.userId, user1Id: l.swipedId },
          ],
        })),
      },
      select: { id: true, user1Id: true, user2Id: true, unlocked: true, matchedAt: true },
    });

    const enriched = myLikes.map(l => {
      const m = matchPairs.find(mp => (mp.user1Id === req.userId && mp.user2Id === l.swipedId) || (mp.user2Id === req.userId && mp.user1Id === l.swipedId));
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
  } catch (error) {
    console.error('Get likes sent error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch likes' });
  }
};

exports.getLikesReceived = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true } });
    const canView = user.tier === 'PREMIUM';

    if (!canView) {
      const paid = await prisma.transaction.findFirst({
        where: { userId: req.userId, type: 'like_viewer', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      });
      if (!paid) {
        return res.json({ success: true, data: { requiresPayment: true, likes: [] } });
      }
    }

    const incoming = await prisma.swipe.findMany({
      where: { swipedId: req.userId, direction: 'like' },
      select: {
        id: true,
        swiperId: true,
        createdAt: true,
        swiper: {
          select: {
            id: true, name: true, age: true, profilePicUrl: true, tier: true,
            county: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const matchPairs = await prisma.match.findMany({
      where: {
        OR: incoming.map(l => ({
          OR: [
            { user1Id: req.userId, user2Id: l.swiperId },
            { user2Id: req.userId, user1Id: l.swiperId },
          ],
        })),
      },
      select: { id: true, user1Id: true, user2Id: true, unlocked: true, matchedAt: true },
    });

    const myLikesBack = await prisma.swipe.findMany({
      where: { swiperId: req.userId, direction: 'like' },
      select: { swipedId: true },
    });
    const likedBackIds = new Set(myLikesBack.map(l => l.swipedId));

    const enriched = incoming.map(l => {
      const m = matchPairs.find(mp => (mp.user1Id === req.userId && mp.user2Id === l.swiperId) || (mp.user2Id === req.userId && mp.user1Id === l.swiperId));
      const iLikedBack = likedBackIds.has(l.swiperId);
      return {
        id: l.id,
        user: l.swiper,
        likedAt: l.createdAt,
        matched: !!m,
        matchId: m?.id || null,
        unlocked: m?.unlocked || false,
        matchedAt: m?.matchedAt || null,
        iLikedBack,
        canApprove: iLikedBack && !m,
      };
    });

    res.json({ success: true, data: { requiresPayment: false, likes: enriched } });
  } catch (error) {
    console.error('Get likes received error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch likes' });
  }
};

exports.approveLike = async (req, res) => {
  try {
    const likerId = parseInt(req.params.likerId);
    if (isNaN(likerId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });

    const incomingLike = await prisma.swipe.findUnique({
      where: { swiperId_swipedId: { swiperId: likerId, swipedId: req.userId } },
    });
    if (!incomingLike || incomingLike.direction !== 'like') {
      return res.status(404).json({ success: false, error: 'No like from this user' });
    }

    const existingMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { user1Id: Math.min(req.userId, likerId), user2Id: Math.max(req.userId, likerId) },
        ],
      },
    });
    if (existingMatch) return res.status(409).json({ success: false, error: 'Already matched' });

    const existingSwipeBack = await prisma.swipe.findUnique({
      where: { swiperId_swipedId: { swiperId: req.userId, swipedId: likerId } },
    });

    if (!existingSwipeBack) {
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, select: { tier: true } });
      if (currentUser.tier === 'FREE') {
        const likeCount = await prisma.swipe.count({
          where: { swiperId: req.userId, direction: 'like' },
        });
        if (likeCount >= 5) {
          return res.status(403).json({
            success: false,
            error: 'Free users get 5 likes. Upgrade to Premium for unlimited likes.',
          });
        }
      }

      await prisma.swipe.create({
        data: { swiperId: req.userId, swipedId: likerId, direction: 'like' },
      });
    }

    const bothPremium = await prisma.user.findMany({
      where: { id: { in: [req.userId, likerId] } },
      select: { tier: true },
    });
    const allPremium = bothPremium.every(u => u.tier === 'PREMIUM');

    const match = await prisma.match.create({
      data: {
        user1Id: Math.min(req.userId, likerId),
        user2Id: Math.max(req.userId, likerId),
        unlocked: allPremium,
      },
    });

    res.json({ success: true, data: { matchId: match.id, unlocked: match.unlocked } });
  } catch (error) {
    console.error('Approve like error:', error);
    res.status(500).json({ success: false, error: 'Failed to approve like' });
  }
};

exports.dismissLike = async (req, res) => {
  try {
    const likerId = parseInt(req.params.likerId);
    if (isNaN(likerId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });

    await prisma.swipe.deleteMany({
      where: { swiperId: likerId, swipedId: req.userId },
    });

    res.json({ success: true, message: 'Like dismissed' });
  } catch (error) {
    console.error('Dismiss like error:', error);
    res.status(500).json({ success: false, error: 'Failed to dismiss like' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Account deactivated' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate account' });
  }
};
