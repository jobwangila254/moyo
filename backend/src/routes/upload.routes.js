const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary.config');
const { authenticate } = require('../middleware/auth.middleware');
const { prisma } = require('../prisma');

router.post('/photo', authenticate, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large. Max 5MB.' : err.message;
      return res.status(400).json({ success: false, error: message });
    }
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { photos: true } });
      const currentPhotos = (() => { try { return JSON.parse(user.photos || '[]'); } catch { return []; } })();

      if (currentPhotos.length >= 6) {
        return res.status(400).json({ success: false, error: 'Max 6 photos allowed' });
      }

      const updated = [...currentPhotos, req.file.path];
      await prisma.user.update({
        where: { id: req.userId },
        data: { photos: JSON.stringify(updated), profilePicUrl: currentPhotos.length === 0 ? req.file.path : undefined },
      });

      res.json({ success: true, data: { url: req.file.path, photos: updated } });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to save photo' });
    }
  });
});

router.delete('/photo', authenticate, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'Photo URL required' });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { photos: true, profilePicUrl: true } });
    const currentPhotos = (() => { try { return JSON.parse(user.photos || '[]'); } catch { return []; } })();

    const filtered = currentPhotos.filter(p => p !== url);
    if (filtered.length === currentPhotos.length) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        photos: JSON.stringify(filtered),
        profilePicUrl: user.profilePicUrl === url ? (filtered[0] || null) : undefined,
      },
    });

    res.json({ success: true, data: { photos: filtered } });
  } catch (error) {
    console.error('Photo delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

module.exports = router;
