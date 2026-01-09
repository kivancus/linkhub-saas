import { createClient } from 'redis';

// Create Redis client but don't connect in development without Redis
const redisClient = createClient({
  url: process.env['REDIS_URL'] || 'redis://localhost:6379',
});

let isConnected = false;

redisClient.on('error', (err) => {
  console.warn('⚠️ Redis connection failed, continuing without Redis:', err.message);
  isConnected = false;
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
  isConnected = true;
});

// Only try to connect to Redis if it's available or in production
if (process.env['NODE_ENV'] === 'production' || process.env['REDIS_ENABLED'] === 'true') {
  redisClient.connect().catch((err) => {
    console.warn('⚠️ Redis connection failed, continuing without Redis:', err.message);
  });
} else {
  console.log('💡 Redis disabled for development. Set REDIS_ENABLED=true to enable.');
}

// Graceful shutdown
process.on('beforeExit', async () => {
  try {
    if (isConnected) {
      await redisClient.quit();
    }
  } catch (error) {
    // Redis might not be connected, ignore error
  }
});

export default redisClient;