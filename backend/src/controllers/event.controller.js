const { prisma } = require('../prisma');

exports.createEvent = async (req, res) => {
  try {
    const { title, description, location, dateTime, maxAttendees } = req.body;
    if (!title || !description || !location || !dateTime) {
      return res.status(400).json({ success: false, error: 'title, description, location, and dateTime required' });
    }

    const event = await prisma.event.create({
      data: {
        creatorId: req.userId,
        title,
        description,
        location,
        dateTime: new Date(dateTime),
        maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
      },
    });

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { attendees: true } },
      },
      orderBy: { dateTime: 'asc' },
      take: 50,
    });

    const enriched = events.map(e => ({
      ...e,
      attendeeCount: e._count.attendees,
      _count: undefined,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ success: false, error: 'Invalid event ID' });

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        creator: { select: { id: true, name: true, profilePicUrl: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, profilePicUrl: true } } },
        },
      },
    });

    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event' });
  }
};

exports.rsvpEvent = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(eventId)) return res.status(400).json({ success: false, error: 'Invalid event ID' });
    if (!status || !['going', 'maybe', 'not_going'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be "going", "maybe", or "not_going"' });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    if (event.maxAttendees && status === 'going') {
      const count = await prisma.rSVP.count({ where: { eventId, status: 'going' } });
      if (count >= event.maxAttendees) {
        return res.status(400).json({ success: false, error: 'Event is full' });
      }
    }

    const rsvp = await prisma.rSVP.upsert({
      where: { eventId_userId: { eventId, userId: req.userId } },
      update: { status },
      create: { eventId, userId: req.userId, status },
    });

    res.json({ success: true, data: rsvp });
  } catch (error) {
    console.error('RSVP error:', error);
    res.status(500).json({ success: false, error: 'Failed to update RSVP' });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ success: false, error: 'Invalid event ID' });

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
    if (event.creatorId !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only the creator can delete this event' });
    }

    await prisma.rSVP.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });

    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
};
