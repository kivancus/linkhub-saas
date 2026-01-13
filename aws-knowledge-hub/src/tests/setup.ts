/**
 * Jest Test Setup
 * 
 * Global test configuration and setup for all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test timeout
jest.setTimeout(30000);

// Mock timers for tests that need them
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});