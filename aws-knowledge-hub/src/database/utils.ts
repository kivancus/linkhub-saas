import { databaseManager } from './connection';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

/**
 * Database utility functions for common operations
 */

/**
 * Clean up expired sessions
 */
export const cleanupExpiredSessions = (): number => {
  try {
    const db = databaseManager.getDatabase();
    const result = db.prepare(`
      DELETE FROM sessions 
      WHERE expires_at < datetime('now')
    `).run();
    
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired sessions`);
    }
    
    return result.changes;
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', { error: getErrorMessage(error) });
    throw error;
  }
};

/**
 * Clean up expired cache entries
 */
export const cleanupExpiredCache = (): number => {
  try {
    const db = databaseManager.getDatabase();
    const result = db.prepare(`
      DELETE FROM documentation_cache 
      WHERE expires_at < datetime('now')
    `).run();
    
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired cache entries`);
    }
    
    return result.changes;
  } catch (error) {
    logger.error('Failed to cleanup expired cache', { error: getErrorMessage(error) });
    throw error;
  }
};

/**
 * Clean up old analytics data (older than specified days)
 */
export const cleanupOldAnalytics = (daysToKeep: number = 90): number => {
  try {
    const db = databaseManager.getDatabase();
    const result = db.prepare(`
      DELETE FROM search_analytics 
      WHERE created_at < datetime('now', '-${daysToKeep} days')
    `).run();
    
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} old analytics entries`);
    }
    
    return result.changes;
  } catch (error) {
    logger.error('Failed to cleanup old analytics', { error: getErrorMessage(error) });
    throw error;
  }
};

/**
 * Update session last activity
 */
export const updateSessionActivity = (sessionId: string): void => {
  try {
    const db = databaseManager.getDatabase();
    db.prepare(`
      UPDATE sessions 
      SET last_activity = datetime('now') 
      WHERE id = ?
    `).run(sessionId);
  } catch (error) {
    logger.error('Failed to update session activity', { 
      error: getErrorMessage(error), 
      sessionId 
    });
    throw error;
  }
};

/**
 * Increment cache access count
 */
export const incrementCacheAccess = (url: string): void => {
  try {
    const db = databaseManager.getDatabase();
    db.prepare(`
      UPDATE documentation_cache 
      SET access_count = access_count + 1 
      WHERE url = ?
    `).run(url);
  } catch (error) {
    logger.error('Failed to increment cache access', { 
      error: getErrorMessage(error), 
      url 
    });
    // Don't throw error for cache statistics
  }
};

/**
 * Get popular AWS services from analytics
 */
export const getPopularAwsServices = (limit: number = 10): any[] => {
  try {
    const db = databaseManager.getDatabase();
    const result = db.prepare(`
      SELECT 
        json_extract(value, '$') as service_name,
        COUNT(*) as usage_count
      FROM search_analytics, json_each(aws_services)
      WHERE aws_services IS NOT NULL
        AND created_at > datetime('now', '-30 days')
      GROUP BY service_name
      ORDER BY usage_count DESC
      LIMIT ?
    `).all(limit);
    
    return result;
  } catch (error) {
    logger.error('Failed to get popular AWS services', { error: getErrorMessage(error) });
    return [];
  }
};

/**
 * Get question patterns for suggestions
 */
export const getQuestionPatterns = (limit: number = 20): any[] => {
  try {
    const db = databaseManager.getDatabase();
    const result = db.prepare(`
      SELECT 
        question,
        COUNT(*) as frequency,
        AVG(response_time) as avg_response_time,
        MAX(created_at) as last_asked
      FROM conversations
      WHERE created_at > datetime('now', '-7 days')
      GROUP BY LOWER(TRIM(question))
      HAVING frequency > 1
      ORDER BY frequency DESC, last_asked DESC
      LIMIT ?
    `).all(limit);
    
    return result;
  } catch (error) {
    logger.error('Failed to get question patterns', { error: getErrorMessage(error) });
    return [];
  }
};

/**
 * Get cache hit rate statistics
 */
export const getCacheStats = (): any => {
  try {
    const db = databaseManager.getDatabase();
    
    const totalEntries = db.prepare(`
      SELECT COUNT(*) as count FROM documentation_cache
    `).get() as { count: number };
    
    const activeEntries = db.prepare(`
      SELECT COUNT(*) as count FROM documentation_cache
      WHERE expires_at > datetime('now')
    `).get() as { count: number };
    
    const topCached = db.prepare(`
      SELECT url, title, access_count, topic
      FROM documentation_cache
      ORDER BY access_count DESC
      LIMIT 10
    `).all();
    
    return {
      total_entries: totalEntries.count,
      active_entries: activeEntries.count,
      expired_entries: totalEntries.count - activeEntries.count,
      top_cached_urls: topCached,
    };
  } catch (error) {
    logger.error('Failed to get cache stats', { error: getErrorMessage(error) });
    return null;
  }
};

/**
 * Vacuum database to reclaim space
 */
export const vacuumDatabase = (): void => {
  try {
    const db = databaseManager.getDatabase();
    db.exec('VACUUM');
    logger.info('Database vacuum completed');
  } catch (error) {
    logger.error('Failed to vacuum database', { error: getErrorMessage(error) });
    throw error;
  }
};

/**
 * Analyze database for query optimization
 */
export const analyzeDatabase = (): void => {
  try {
    const db = databaseManager.getDatabase();
    db.exec('ANALYZE');
    logger.info('Database analysis completed');
  } catch (error) {
    logger.error('Failed to analyze database', { error: getErrorMessage(error) });
    throw error;
  }
};

/**
 * Run all maintenance tasks
 */
export const runMaintenance = (): void => {
  logger.info('Starting database maintenance');
  
  try {
    const expiredSessions = cleanupExpiredSessions();
    const expiredCache = cleanupExpiredCache();
    const oldAnalytics = cleanupOldAnalytics();
    
    analyzeDatabase();
    
    logger.info('Database maintenance completed', {
      expired_sessions_cleaned: expiredSessions,
      expired_cache_cleaned: expiredCache,
      old_analytics_cleaned: oldAnalytics,
    });
  } catch (error) {
    logger.error('Database maintenance failed', { error: getErrorMessage(error) });
    throw error;
  }
};