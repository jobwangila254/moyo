module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/config/*.config.js',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    'expo-server-sdk': '<rootDir>/__mocks__/expo-server-sdk.js',
    '^.*notificationService.*$': '<rootDir>/__mocks__/notificationService.js',
  },
};

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-purposes-32chars';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
