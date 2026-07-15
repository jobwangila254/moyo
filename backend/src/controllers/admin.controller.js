const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, safeJsonParse } = require('../prisma');
const catchAsync = require('../utils/catchAsync');
const { AppError } = require('../middleware/errorHandler');

const generateAdminToken = userId => {
  return jwt.sign({ userId, role: 'ADMIN' }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
};

exports.login = catchAsync(async (req, res) => {
  const { phone, password } = req.body;

  const phoneClean = phone.replace(/[^0-9]/g, '');
  const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

  if (!user) {
    throw new AppError('Invalid phone or password', 401);
  }

  if (user.role !== 'ADMIN') {
    throw new AppError('Admin access required', 403);
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Invalid phone or password', 401);
  }

  const token = generateAdminToken(user.id);

  res.json({
    success: true,
    data: {
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      token,
    },
  });
});

exports.getUsers = catchAsync(async (req, res) => {
  const { page = '1', search, tier, isActive, sort = 'createdAt', order = 'desc' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = 20;

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }
  if (tier && ['FREE', 'PREMIUM'].includes(tier)) {
    where.tier = tier;
  }
  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true';
  }

  const orderBy = { [sort]: order === 'asc' ? 'asc' : 'desc' };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        age: true,
        gender: true,
        tier: true,
        role: true,
        isActive: true,
        phoneVerified: true,
        photoModerationStatus: true,
        county: { select: { name: true } },
        createdAt: true,
        _count: { select: { matchesAsUser1: true, matchesAsUser2: true, reportsFiled: true, reportsReceived: true } },
      },
      orderBy,
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: users.map(u => ({
      ...u,
      matchCount: u._count.matchesAsUser1 + u._count.matchesAsUser2,
      reportsFiledCount: u._count.reportsFiled,
      reportsReceivedCount: u._count.reportsReceived,
      _count: undefined,
    })),
    pagination: { page: pageNum, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

exports.getUserById = catchAsync(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {throw new AppError('Invalid user ID', 400);}

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, phone: true, age: true, gender: true,
      interestedIn: true, bio: true, occupation: true, tier: true,
      role: true, isActive: true, phoneVerified: true, photoModerationStatus: true,
      likes: true, hobbies: true, photos: true, profilePicUrl: true,
      county: { select: { id: true, name: true } },
      createdAt: true, updatedAt: true,
      _count: {
        select: {
          matchesAsUser1: true, matchesAsUser2: true,
          reportsFiled: true, reportsReceived: true,
          swipesGiven: true, transactions: true, events: true,
        },
      },
    },
  });

  if (!user) {throw new AppError('User not found', 404);}

  const reports = await prisma.report.findMany({
    where: { reportedId: userId },
    include: { reporter: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  res.json({
    success: true,
    data: {
      ...user,
      likes: safeJsonParse(user.likes),
      hobbies: safeJsonParse(user.hobbies),
      photos: safeJsonParse(user.photos),
      matchCount: user._count.matchesAsUser1 + user._count.matchesAsUser2,
      _count: undefined,
      reports,
    },
  });
});

exports.updateUser = catchAsync(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {throw new AppError('Invalid user ID', 400);}

  const { tier, role, isActive, name, bio, occupation, phoneVerified, photoModerationStatus } = req.body;
  const data = {};

  if (tier !== undefined) {data.tier = tier;}
  if (role !== undefined) {data.role = role;}
  if (isActive !== undefined) {data.isActive = isActive;}
  if (name !== undefined) {data.name = name;}
  if (bio !== undefined) {data.bio = bio;}
  if (occupation !== undefined) {data.occupation = occupation;}
  if (phoneVerified !== undefined) {data.phoneVerified = phoneVerified;}
  if (photoModerationStatus !== undefined) {data.photoModerationStatus = photoModerationStatus;}

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, name: true, phone: true, tier: true, role: true,
      isActive: true, phoneVerified: true, photoModerationStatus: true,
    },
  });

  res.json({ success: true, data: user });
});

exports.deleteUser = catchAsync(async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {throw new AppError('Invalid user ID', 400);}

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  res.json({ success: true, message: 'User deactivated' });
});

exports.getReports = catchAsync(async (req, res) => {
  const { page = '1', status } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = 20;

  const where = {};
  if (status && ['pending', 'reviewed', 'dismissed', 'resolved'].includes(status)) {
    where.status = status;
  }

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, name: true, phone: true, profilePicUrl: true } },
        reported: { select: { id: true, name: true, phone: true, profilePicUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.report.count({ where }),
  ]);

  res.json({
    success: true,
    data: reports,
    pagination: { page: pageNum, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

exports.updateReport = catchAsync(async (req, res) => {
  const reportId = parseInt(req.params.id, 10);
  if (isNaN(reportId)) {throw new AppError('Invalid report ID', 400);}

  const { status } = req.body;
  if (!['pending', 'reviewed', 'dismissed', 'resolved'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status },
    include: {
      reporter: { select: { id: true, name: true } },
      reported: { select: { id: true, name: true } },
    },
  });

  res.json({ success: true, data: report });
});

exports.getFlaggedPhotos = catchAsync(async (req, res) => {
  const { page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = 20;

  const where = { photoModerationStatus: 'flagged' };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, phone: true, age: true,
        photos: true, profilePicUrl: true, photoModerationStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: users.map(u => ({ ...u, photos: safeJsonParse(u.photos) })),
    pagination: { page: pageNum, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

exports.getAnalyticsOverview = catchAsync(async (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, activeUsers, premiumUsers,
    totalMatches, totalMessages, pendingReports,
    flaggedPhotos, recentUsers, totalRevenue,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { tier: 'PREMIUM' } }),
    prisma.match.count(),
    prisma.message.count(),
    prisma.report.count({ where: { status: 'pending' } }),
    prisma.user.count({ where: { photoModerationStatus: 'flagged' } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
  ]);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayUsers = await prisma.user.count({ where: { createdAt: { gte: todayStart } } });

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      premiumUsers,
      freeUsers: totalUsers - premiumUsers,
      totalMatches,
      totalMessages,
      pendingReports,
      flaggedPhotos,
      recentUsers,
      todayUsers,
      totalRevenue: totalRevenue._sum.amount || 0,
    },
  });
});

exports.getSignups = catchAsync(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const signupsByDay = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    signupsByDay[key] = 0;
  }

  users.forEach(u => {
    const key = u.createdAt.toISOString().split('T')[0];
    if (signupsByDay[key] !== undefined) {
      signupsByDay[key]++;
    }
  });

  const data = Object.entries(signupsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({ success: true, data });
});

exports.getEvents = catchAsync(async (req, res) => {
  const events = await prisma.userEvent.groupBy({
    by: ['eventType'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  res.json({
    success: true,
    data: events.map(e => ({ eventType: e.eventType, count: e._count.id })),
  });
});
