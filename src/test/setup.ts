import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Simple test setup without database operations for now
beforeAll(async () => {
  // Test setup will be expanded when we add database tests
});

afterAll(async () => {
  // Cleanup will be added when we add database tests
});