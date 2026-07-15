import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getItem, setItem, removeItem } from './storage';

const TOKEN_KEY = 'authToken';

let cachedToken = null;

const loadToken = async () => {
  try {
    const stored = await getItem(TOKEN_KEY);
    if (stored) {cachedToken = stored;}
  } catch { /* ignore */ }
};

const saveToken = async (token) => {
  cachedToken = token;
  await setItem(TOKEN_KEY, token).catch(() => {});
};

export const setAuthToken = async (token) => {
  await saveToken(token);
};

export const getAuthToken = () => cachedToken;

export const clearAuthToken = async () => {
  cachedToken = null;
  await removeItem(TOKEN_KEY).catch(() => {});
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  if (!cachedToken) {
    try {
      const stored = await getItem(TOKEN_KEY);
      if (stored) {cachedToken = stored;}
    } catch { /* ignore */ }
  }
  if (cachedToken) {
    config.headers.Authorization = `Bearer ${cachedToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      cachedToken = null;
      await removeItem(TOKEN_KEY).catch(() => {});
    }
    return Promise.reject(error);
  },
);

loadToken();

export const auth = {
  register: (data) => api.post('/auth/register', data),
  verifyPhone: (data) => api.post('/auth/verify-phone', data),
  resendCode: (phone) => api.post('/auth/resend-code', { phone }),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (phone) => api.post('/auth/forgot-password', { phone }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

export const users = {
  getCounties: () => api.get('/users/counties'),
  getProfiles: (params) => api.get('/users/profiles', { params }),
  getProfileById: (id) => api.get(`/users/profiles/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  swipe: (data) => api.post('/users/swipe', data),
  getMatches: () => api.get('/users/matches'),
  getMessages: (matchId) => api.get(`/users/matches/${matchId}/messages`),
  sendMessage: (matchId, content) => api.post(`/users/matches/${matchId}/messages`, { content }),
  getLikesSent: () => api.get('/users/likes/sent'),
  getLikesReceived: () => api.get('/users/likes/received'),
  approveLike: (likerId) => api.post(`/users/likes/approve/${likerId}`),
  dismissLike: (likerId) => api.post(`/users/likes/dismiss/${likerId}`),
  reportUser: (data) => api.post('/users/report', data),
  getSafetyStatus: () => api.get('/users/safety-status'),
  deleteAccount: () => api.delete('/users/account'),
  updatePushToken: (token) => api.post('/users/push-token', { token }),
  useFreeUnlock: (likerId) => api.post(`/users/likes/use-free-unlock/${likerId}`),
  completeOnboarding: () => api.post('/users/complete-onboarding'),
  getSettings: () => api.get('/users/settings'),
  updateSettings: (data) => api.put('/users/settings', data),
  getBlockedUsers: () => api.get('/users/blocks'),
  unblockUser: (userId) => api.delete(`/users/block/${userId}`),
  blockUser: (userId) => api.post(`/users/block/${userId}`),
  getProfileViews: () => api.get('/users/profile-views'),
  boostProfile: () => api.post('/users/boost'),
  flagPhoto: (reason) => api.post('/users/flag-photo', { reason }),
};

export const payments = {
  initiateSTKPush: (data) => api.post('/payments/stk-push', data),
  getStatus: (transactionId) => api.get(`/payments/status/${transactionId}`),
  getHistory: () => api.get('/payments/history'),
};

export const uploadApi = {
  uploadPhoto: (formData) => api.post('/upload/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deletePhoto: (url) => api.delete('/upload/photo', { data: { url } }),
};

export default api;
