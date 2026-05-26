const isWeb = typeof window !== 'undefined';

let SecureStore;
try {
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

const webStorage = {
  getItemAsync: async (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItemAsync: async (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  deleteItemAsync: async (key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

const storage = SecureStore?.getItemAsync ? SecureStore : webStorage;

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
  } catch {}
};

export const removeItem = async (key) => {
  try {
    await storage.deleteItemAsync(key);
  } catch {}
};
