const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
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
  const videosDir = path.join(uploadsDir, 'videos');
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }

  const videoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, videosDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${unique}${ext}`);
    },
  });

  const videoUpload = multer({
    storage: videoStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['video/mp4', 'video/quicktime'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only video files (mp4, mov) are allowed'), false);
      }
    },
  });

  router.get('/photos/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    res.sendFile(filePath);
  });

  router.get('/videos/:filename', (req, res) => {
    const filePath = path.join(videosDir, req.params.filename);
    res.sendFile(filePath);
  });

  router.post('/video', authenticate, (req, res) => {
    videoUpload.single('video')(req, res, async err => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 10MB.' : err.message;
        return res.status(400).json({ success: false, error: message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No video file uploaded' });
      }

      try {
        const url = `/api/upload/videos/${req.file.filename}`;
        await prisma.user.update({
          where: { id: req.userId },
          data: { videoUrl: url },
        });

        res.json({ success: true, data: { url } });
      } catch (error) {
        logger.error('Video upload error:', error);
        res.status(500).json({ success: false, error: 'Failed to save video' });
      }
    });
  });

  router.delete('/video', authenticate, catchAsync(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { videoUrl: true },
    });

    if (!user.videoUrl) {
      throw new AppError('No video to remove', 404);
    }

    const filename = path.basename(user.videoUrl);
    const filePath = path.join(videosDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { videoUrl: null },
    });

    res.json({ success: true, message: 'Video removed' });
  }));
} else {
  router.get('/photos/:filename', (req, res) => {
    const filePath = path.join(__dirname, '..', '..', 'uploads', req.params.filename);
    res.sendFile(filePath);
  });

  router.post('/video', authenticate, (req, res) => {
    const videoStorage = multer.memoryStorage();
    const videoUploadMulter = multer({
      storage: videoStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['video/mp4', 'video/quicktime'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only video files (mp4, mov) are allowed'), false);
        }
      },
    });

    videoUploadMulter.single('video')(req, res, async err => {
      if (err) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 10MB.' : err.message;
        return res.status(400).json({ success: false, error: message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No video file uploaded' });
      }

      try {
        const { cloudinary } = require('../config/cloudinary.config');
        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const result = await cloudinary.uploader.upload(base64, {
          folder: 'moyo/videos',
          resource_type: 'video',
          transformation: [{ duration: 15 }],
        });

        await prisma.user.update({
          where: { id: req.userId },
          data: { videoUrl: result.secure_url },
        });

        res.json({ success: true, data: { url: result.secure_url } });
      } catch (error) {
        logger.error('Video upload error:', error);
        res.status(500).json({ success: false, error: 'Failed to save video' });
      }
    });
  });

  router.delete('/video', authenticate, catchAsync(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { videoUrl: true },
    });

    if (!user.videoUrl) {
      throw new AppError('No video to remove', 404);
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { videoUrl: null },
    });

    res.json({ success: true, message: 'Video removed' });
  }));
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
