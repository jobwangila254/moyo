const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma, safeJsonParse } = require('../prisma');

const generateToken = (userId, tier) => {
  return jwt.sign({ userId, tier }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

exports.register = async (req, res) => {
  try {
    const { phone, password, name, age, gender, interestedIn, countyId, bio, occupation, likes, hobbies } = req.body;

    if (!phone || !password || !name || !age || !gender || !countyId) {
      return res.status(400).json({ success: false, error: 'Missing required fields: phone, password, name, age, gender, countyId' });
    }

    const phoneClean = phone.replace(/[^0-9]/g, '');
    if (phoneClean.length < 10) {
      return res.status(400).json({ success: false, error: 'Invalid phone number. Use format 07XX XXX XXX' });
    }

    const existing = await prisma.user.findUnique({ where: { phone: phoneClean } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Phone number already registered' });
    }

    const countyExists = await prisma.county.findUnique({ where: { id: parseInt(countyId) } });
    if (!countyExists) {
      return res.status(400).json({ success: false, error: 'Invalid county' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

    const user = await prisma.user.create({
      data: {
        phone: phoneClean,
        passwordHash,
        name: name.trim(),
        age: parseInt(age),
        gender: gender.toLowerCase(),
        interestedIn: interestedIn ? interestedIn.toLowerCase() : 'both',
        countyId: parseInt(countyId),
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

    console.log(`[SMS SIMULATION] Verification code for ${phoneClean}: ${verificationCode}`);

    res.status(201).json({
      success: true,
      message: 'Account created. Please verify your phone number with the code sent via SMS.',
      data: { phone: user.phone, userId: user.id },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
};

exports.verifyPhone = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, error: 'Phone and verification code required' });
    }

    const phoneClean = phone.replace(/[^0-9]/g, '');
    const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.phoneVerified) {
      return res.status(400).json({ success: false, error: 'Phone already verified' });
    }

    if (user.phoneVerificationCode !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
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
        user: { id: user.id, phone: user.phone, name: user.name, tier: user.tier, countyId: user.countyId, age: user.age, gender: user.gender },
        token,
      },
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
};

exports.resendCode = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number required' });

    const phoneClean = phone.replace(/[^0-9]/g, '');
    const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.phoneVerified) return res.status(400).json({ success: false, error: 'Phone already verified' });

    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerificationCode: newCode },
    });

    console.log(`[SMS SIMULATION] New verification code for ${phoneClean}: ${newCode}`);

    res.json({ success: true, message: 'Verification code resent' });
  } catch (error) {
    console.error('Resend code error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend code' });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, error: 'Phone and password required' });
    }

    const phoneClean = phone.replace(/[^0-9]/g, '');
    const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid phone or password' });
    }

    if (!user.phoneVerified) {
      return res.status(403).json({ success: false, error: 'Phone not verified. Please verify your phone number first.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid phone or password' });
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        county: { select: { id: true, name: true } },
        _count: {
          select: {
            matchesAsUser1: true,
            matchesAsUser2: true,
            eventsCreated: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const matchCount = user._count.matchesAsUser1 + user._count.matchesAsUser2;

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
        matchCount,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user data' });
  }
};
