const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, safeJsonParse } = require('../prisma');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

const generateToken = (userId, tier) => {
  return jwt.sign({ userId, tier }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

exports.register = catchAsync(async (req, res) => {
  const { phone, password, name, age, gender, interestedIn, countyId, bio, occupation, likes, hobbies } = req.body;

  const phoneClean = phone.replace(/[^0-9]/g, '');
  if (phoneClean.length < 10) {
    throw new AppError('Invalid phone number. Use format 07XX XXX XXX', 400);
  }

  const existing = await prisma.user.findUnique({ where: { phone: phoneClean } });
  if (existing) {
    throw new AppError('Phone number already registered', 409);
  }

  const countyExists = await prisma.county.findUnique({ where: { id: parseInt(countyId, 10) } });
  if (!countyExists) {
    throw new AppError('Invalid county', 400);
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

  const user = await prisma.user.create({
    data: {
      phone: phoneClean,
      passwordHash,
      name: name.trim(),
      age: parseInt(age, 10),
      gender: gender.toLowerCase(),
      interestedIn: interestedIn ? interestedIn.toLowerCase() : 'both',
      countyId: parseInt(countyId, 10),
      bio: bio || null,
      occupation: occupation || null,
      likes: likes ? JSON.stringify(likes) : '[]',
      hobbies: hobbies ? JSON.stringify(hobbies) : '[]',
      photos: '[]',
      profilePicUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007AFF&color=fff&size=300`,
      phoneVerificationCode: verificationCode,
      phoneVerified: false,
    },
  });

  logger.info(`[SMS SIMULATION] Verification code for ${phoneClean}: ${verificationCode}`);

  res.status(201).json({
    success: true,
    message: 'Account created. Please verify your phone number with the code sent via SMS.',
    data: { phone: user.phone, userId: user.id },
  });
});

exports.verifyPhone = catchAsync(async (req, res) => {
  const { phone, code } = req.body;

  const phoneClean = phone.replace(/[^0-9]/g, '');
  const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

  if (!user || user.phoneVerified || !user.phoneVerificationCode) {
    throw new AppError('Invalid or expired verification request', 400);
  }

  if (user.phoneVerificationCode !== code) {
    throw new AppError('Invalid verification code', 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { phoneVerified: true, phoneVerificationCode: null },
  });

  const token = generateToken(user.id, user.tier);

  res.json({
    success: true,
    message: 'Phone verified successfully',
    data: {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        tier: user.tier,
        countyId: user.countyId,
        age: user.age,
        gender: user.gender,
      },
      token,
    },
  });
});

exports.resendCode = catchAsync(async (req, res) => {
  const { phone } = req.body;

  const phoneClean = phone.replace(/[^0-9]/g, '');
  const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

  if (!user || user.phoneVerified) {
    throw new AppError('Unable to resend code. Please try registering again.', 400);
  }

  const newCode = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.user.update({
    where: { id: user.id },
    data: { phoneVerificationCode: newCode },
  });

  logger.info(`[SMS SIMULATION] New verification code for ${phoneClean}: ${newCode}`);

  res.json({ success: true, message: 'Verification code resent' });
});

exports.login = catchAsync(async (req, res) => {
  const { phone, password } = req.body;

  const phoneClean = phone.replace(/[^0-9]/g, '');
  const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

  if (!user) {
    throw new AppError('Invalid phone or password', 401);
  }

  if (!user.phoneVerified) {
    throw new AppError('Phone not verified. Please verify your phone number first.', 403);
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError('Invalid phone or password', 401);
  }

  const token = generateToken(user.id, user.tier);

  const county = await prisma.county.findUnique({ where: { id: user.countyId } });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        age: user.age,
        gender: user.gender,
        interestedIn: user.interestedIn,
        countyId: user.countyId,
        county: county?.name,
        tier: user.tier,
        isVerified: user.phoneVerified,
        profilePicUrl: user.profilePicUrl,
      },
      token,
    },
  });
});

exports.forgotPassword = catchAsync(async (req, res) => {
  const { phone } = req.body;
  const phoneClean = phone.replace(/[^0-9]/g, '');
  const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

  if (user) {
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerificationCode: resetCode },
    });
    logger.info(`[SMS SIMULATION] Password reset code for ${phoneClean}: ${resetCode}`);
  }

  res.json({
    success: true,
    message: 'If the phone is registered, a reset code will be sent via SMS.',
  });
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { phone, code, password } = req.body;
  const phoneClean = phone.replace(/[^0-9]/g, '');
  const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

  if (!user || user.phoneVerificationCode !== code) {
    throw new AppError('Invalid or expired reset code', 400);
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, phoneVerificationCode: null },
  });

  res.json({ success: true, message: 'Password reset successfully' });
});

exports.getMe = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      county: { select: { id: true, name: true } },
      _count: {
        select: {
          matchesAsUser1: true,
          matchesAsUser2: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const matchCount = user._count.matchesAsUser1 + user._count.matchesAsUser2;

  const daysSinceRegistration = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    success: true,
    data: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      age: user.age,
      gender: user.gender,
      interestedIn: user.interestedIn,
      countyId: user.countyId,
      county: user.county,
      bio: user.bio,
      occupation: user.occupation,
      likes: safeJsonParse(user.likes),
      hobbies: safeJsonParse(user.hobbies),
      photos: safeJsonParse(user.photos),
      profilePicUrl: user.profilePicUrl,
      isVerified: user.phoneVerified,
      tier: user.tier,
      freeUnlocksRemaining: user.freeUnlocksRemaining,
      unlimitedChat: user.unlimitedChat,
      matchCount,
      createdAt: user.createdAt,
      safety: {
        showSafetyReminder: daysSinceRegistration <= 7,
        showMeetingSafetyPrompt: matchCount > 0,
      },
    },
  });
});
