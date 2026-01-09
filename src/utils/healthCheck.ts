import prisma from '../config/database';
import redis from '../config/redis';
import logger from './logger';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy' | 'disabled';
    memory: {
      used: string;
      total: string;
      percentage: number;
    };
  };
  version: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();
  
  // Memory usage
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const memoryPercentage = (usedMemory / totalMemory) * 100;

  const health: HealthStatus = {
    status: 'healthy',
    timestamp,
    uptime,
    services: {
      database: 'unhealthy',
      redis: 'unhealthy',
      memory: {
        used: `${Math.round(usedMemory / 1024 / 1024)}MB`,
        total: `${Math.round(totalMemory / 1024 / 1024)}MB`,
        percentage: Math.round(memoryPercentage),
      },
    },
    version: process.env['npm_package_version'] || '1.0.0',
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'healthy';
  } catch (error) {
    logger.error('Database health check failed', { error });
    health.status = 'unhealthy';
  }

  // Check Redis connection (only if enabled)
  if (process.env['NODE_ENV'] === 'production' || process.env['REDIS_ENABLED'] === 'true') {
    try {
      await redis.ping();
      health.services.redis = 'healthy';
    } catch (error) {
      logger.warn('Redis health check failed', { error });
      health.services.redis = 'unhealthy';
    }
  } else {
    health.services.redis = 'disabled';
  }

  // Check memory usage (alert if >95% instead of 90%)
  if (memoryPercentage > 95) {
    logger.warn('High memory usage detected', { percentage: memoryPercentage });
    health.status = 'unhealthy';
  }

  return health;
}