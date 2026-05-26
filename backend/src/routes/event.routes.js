const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/', authenticate, eventController.getEvents);
router.get('/:id', authenticate, eventController.getEventById);
router.post('/', authenticate, eventController.createEvent);
router.post('/:id/rsvp', authenticate, eventController.rsvpEvent);
router.delete('/:id', authenticate, eventController.deleteEvent);

module.exports = router;
