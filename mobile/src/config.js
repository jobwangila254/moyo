import { Platform } from 'react-native';

const DEV_API = Platform.select({
  web: 'http://localhost:5000/api',
  default: 'http://192.168.1.100:5000/api',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API;
