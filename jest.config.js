export default {
  testEnvironment: 'node',
  testTimeout: 60000,
  setupFiles: ['<rootDir>/tests/jest/setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/jest/'],
  collectCoverageFrom: ['src/**/*.js'],
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 80,
      functions: 90,
      statements: 90
    }
  },
  coverageReporters: ['text', 'lcov']
}
