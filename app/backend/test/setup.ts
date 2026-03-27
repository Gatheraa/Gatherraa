// Jest setup file for property-based testing
// This file runs before each test file

// Set default timeout for property-based tests
jest.setTimeout(30000);

// Global test utilities
global.fc = require('fast-check');

// Mock console methods to reduce noise during property testing
const originalConsole = { ...console };

beforeEach(() => {
  // Suppress console logs during property tests to reduce noise
  console.log = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

afterEach(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Handle unhandled promise rejections in property tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Set up global test configuration for fast-check
global.testConfig = {
  numRuns: process.env.TEST_NUM_RUNS ? parseInt(process.env.TEST_NUM_RUNS) : 100,
  timeout: process.env.TEST_TIMEOUT ? parseInt(process.env.TEST_TIMEOUT) : 30000,
  verbose: process.env.TEST_VERBOSE === 'true',
};
