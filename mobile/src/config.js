import { Platform } from 'react-native';

const DEV_API = 'http://localhost:5000/api';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API;
