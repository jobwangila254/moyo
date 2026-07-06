const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

let io = null;

function initSocketIO(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true },
      });
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.userId = user.id;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', socket => {
    socket.join(`user:${socket.userId}`);

    socket.on('joinMatch', ({ matchId }) => {
      socket.join(`match:${matchId}`);
    });

    socket.on('leaveMatch', ({ matchId }) => {
      socket.leave(`match:${matchId}`);
    });

    socket.on('disconnect', () => {
      // cleanup if needed
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

module.exports = { initSocketIO, getIO };
