import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { getAuthToken } from './api';

let socket = null;

export const connectSocket = async () => {
  if (socket?.connected) { return socket; }
  const token = getAuthToken();
  if (!token) { return null; }

  const serverUrl = API_BASE_URL.replace('/api', '');

  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('connect_error', (err) => console.log('Socket error:', err.message));

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const joinMatchRoom = (matchId) => {
  if (socket?.connected) {
    socket.emit('joinMatch', { matchId });
  }
};

export const leaveMatchRoom = (matchId) => {
  if (socket?.connected) {
    socket.emit('leaveMatch', { matchId });
  }
};

export const onNewMessage = (callback) => {
  if (socket) {
    socket.on('newMessage', callback);
    return () => socket.off('newMessage', callback);
  }
  return () => {};
};
