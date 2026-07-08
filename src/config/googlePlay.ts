import dotenv from 'dotenv';
dotenv.config();

export const googlePlayConfig = {
  enabled: process.env.GOOGLE_PLAY_ENABLED === 'true',
  mockMode: process.env.GOOGLE_PLAY_MOCK_MODE === 'true',
  packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.example.app',
};