const express = require('express');
const router = express.Router();
const path = require('path');
const { upload, useCloudinary } = require('../config/cloudinary.config');
const { authenticate } = require('../middleware/auth.middleware');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { prisma } = require('../prisma');
const { AppError } = require('../middleware/errorHandler');

const MAX_PHOTOS = 6;

function fileUrl(file) {
  if (useCloudinary) {
    return file.path;
  }
  return `/api/upload/photos/${file.filename}`;
}

router.post('/photo', authenticate, (req, res) => {
  upload.single('photo')(req, res, async err => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 5MB.' : err.message;
      return res.status(400).json({ success: false, error: message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { photos: true } });
      const currentPhotos = (() => {
        try {
          return JSON.parse(user.photos || '[]');
        } catch {
          return [];
        }
      })();

      if (currentPhotos.length >= MAX_PHOTOS) {
        return res.status(400).json({ success: false, error: `Max ${MAX_PHOTOS} photos allowed` });
      }

      const url = fileUrl(req.file);
      const updated = [...currentPhotos, url];
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          photos: JSON.stringify(updated),
          profilePicUrl: currentPhotos.length === 0 ? url : undefined,
        },
      });

      res.json({ success: true, data: { url, photos: updated } });
    } catch (error) {
      logger.error('Photo upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to save photo' });
    }
  });
});

if (!useCloudinary) {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  router.get('/photos/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    res.sendFile(filePath);
  });
}

router.delete('/photo', authenticate, catchAsync(async (req, res) => {
  const { url } = req.body;
  if (!url) {
    throw new AppError('Photo URL required', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { photos: true, profilePicUrl: true },
  });
  const currentPhotos = (() => {
    try {
      return JSON.parse(user.photos || '[]');
    } catch {
      return [];
    }
  })();

  const filtered = currentPhotos.filter(p => p !== url);
  if (filtered.length === currentPhotos.length) {
    throw new AppError('Photo not found', 404);
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: {
      photos: JSON.stringify(filtered),
      profilePicUrl: user.profilePicUrl === url ? filtered[0] || null : undefined,
    },
  });

  res.json({ success: true, data: { photos: filtered } });
}));

module.exports = router;
