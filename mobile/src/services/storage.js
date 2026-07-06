import { Platform } from 'react-native';

const webStorage = {
  getItemAsync: async (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch { return null; }
  },
  setItemAsync: async (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch { /* ignore */ }
  },
  deleteItemAsync: async (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};

const storage = Platform.OS === 'web'
  ? webStorage
  : (() => {
      let SecureStore;
      try { SecureStore = require('expo-secure-store'); } catch { SecureStore = null; }
      return SecureStore?.getItemAsync ? SecureStore : webStorage;
    })();

export const getItem = async (key) => {
  try {
    return await storage.getItemAsync(key);
  } catch {
    return null;
  }
};

export const setItem = async (key, value) => {
  try {
    await storage.setItemAsync(key, value);
  } catch { /* ignore */ }
};

export const removeItem = async (key) => {
  try {
    await storage.deleteItemAsync(key);
  } catch { /* ignore */ }
};
