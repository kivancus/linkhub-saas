import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';
import { databaseManager } from '../database/connection';

/**
 * Session Management Service
 * 
 * Handles user sessions, conversation history, and context management
 */

interface Session {
  id: string;
  userId?: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  metadata: SessionMetadata;
}

interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
  source?: string;
  userId?: string;
  preferences?: Record<string, any>;
}

interface ConversationEntry {
  id: string;
  sessionId: string;
  questionId: string;
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  timestamp: Date;
  processingTime: number;
}

interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalConversations: number;
  averageSessionDuration: number;
  topQuestionTypes: Array<{ type: string; count: number }>;
}

class SessionManager {
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Create a new session
   */
  public async createSession(metadata: SessionMetadata = {}): Promise<Session> {
    try {
      const sessionId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.SESSION_TIMEOUT);

      const session: Session = {
        id: sessionId,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        metadata
      };

      // Store in database
      const db = databaseManager.getDatabase();
      db.prepare(`
        INSERT INTO sessions (
          id, created_at, last_activity, expires_at, metadata
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        sessionId,
        now.toISOString(),
        now.toISOString(),
        expiresAt.toISOString(),
        JSON.stringify(metadata)
      );

      logger.info('Session created', {
        sessionId,
        source: metadata.source,
        userAgent: metadata.userAgent
      });

      return session;

    } catch (error) {
      logger.error('Failed to create session', {
        error: getErrorMessage(error),
        metadata
      });
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  public async getSession(sessionId: string): Promise<Session | null> {
    try {
      const db = databaseManager.getDatabase();
      const row = db.prepare(`
        SELECT id, created_at, last_activity, expires_at, metadata
        FROM sessions 
        WHERE id = ? AND expires_at > datetime('now')
      `).get(sessionId) as any;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: JSON.parse(row.metadata || '{}').userId,
        createdAt: new Date(row.created_at),
        lastActivity: new Date(row.last_activity),
        expiresAt: new Date(row.expires_at),
        metadata: JSON.parse(row.metadata || '{}')
      };

    } catch (error) {
      logger.error('Failed to get session', {
        error: getErrorMessage(error),
        sessionId
      });
      return null;
    }
  }

  /**
   * Update session activity
   */
  public async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const db = databaseManager.getDatabase();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.SESSION_TIMEOUT);

      const result = db.prepare(`
        UPDATE sessions 
        SET last_activity = ?, expires_at = ?
        WHERE id = ?
      `).run(now.toISOString(), expiresAt.toISOString(), sessionId);

      return result.changes > 0;

    } catch (error) {
      logger.error('Failed to update session activity', {
        error: getErrorMessage(error),
        sessionId
      });
      return false;
    }
  }

  /**
   * Delete session
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const db = databaseManager.getDatabase();
      
      // Delete conversations first (foreign key constraint)
      db.prepare(`DELETE FROM conversations WHERE session_id = ?`).run(sessionId);
      
      // Delete session
      const result = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);

      logger.info('Session deleted', { sessionId });
      return result.changes > 0;

    } catch (error) {
      logger.error('Failed to delete session', {
        error: getErrorMessage(error),
        sessionId
      });
      return false;
    }
  }

  /**
   * Store conversation entry
   */
  public async storeConversation(
    sessionId: string,
    questionId: string,
    question: string,
    answer: string,
    confidence: number,
    sources: string[] = [],
    processingTime: number = 0
  ): Promise<string> {
    try {
      const conversationId = uuidv4();
      const db = databaseManager.getDatabase();

      db.prepare(`
        INSERT INTO conversations (
          session_id, question, answer, 
          confidence_score, sources, response_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        question,
        answer,
        confidence,
        JSON.stringify(sources),
        processingTime,
        new Date().toISOString()
      );

      // Update session activity
      await this.updateSessionActivity(sessionId);

      logger.debug('Conversation stored', {
        conversationId,
        sessionId,
        questionLength: question.length,
        answerLength: answer.length
      });

      return conversationId;

    } catch (error) {
      logger.error('Failed to store conversation', {
        error: getErrorMessage(error),
        sessionId,
        questionId
      });
      throw error;
    }
  }

  /**
   * Get conversation history for a session
   */
  public async getConversationHistory(
    sessionId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ConversationEntry[]> {
    try {
      const db = databaseManager.getDatabase();
      const rows = db.prepare(`
        SELECT id, session_id, question, answer,
               confidence_score, sources, response_time, created_at
        FROM conversations 
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(sessionId, limit, offset) as any[];

      return rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        questionId: row.id.toString(),
        question: row.question,
        answer: row.answer,
        confidence: row.confidence_score,
        sources: JSON.parse(row.sources || '[]'),
        timestamp: new Date(row.created_at),
        processingTime: row.response_time
      }));

    } catch (error) {
      logger.error('Failed to get conversation history', {
        error: getErrorMessage(error),
        sessionId
      });
      return [];
    }
  }

  /**
   * Search conversations
   */
  public async searchConversations(
    sessionId: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<ConversationEntry[]> {
    try {
      const db = databaseManager.getDatabase();
      const rows = db.prepare(`
        SELECT id, session_id, question, answer,
               confidence_score, sources, response_time, created_at
        FROM conversations 
        WHERE session_id = ? AND (
          question LIKE ? OR answer LIKE ?
        )
        ORDER BY created_at DESC
        LIMIT ?
      `).all(sessionId, `%${searchTerm}%`, `%${searchTerm}%`, limit) as any[];

      return rows.map(row => ({
        id: row.id,
        sessionId: row.session_id,
        questionId: row.id.toString(),
        question: row.question,
        answer: row.answer,
        confidence: row.confidence_score,
        sources: JSON.parse(row.sources || '[]'),
        timestamp: new Date(row.created_at),
        processingTime: row.response_time
      }));

    } catch (error) {
      logger.error('Failed to search conversations', {
        error: getErrorMessage(error),
        sessionId,
        searchTerm
      });
      return [];
    }
  }

  /**
   * Get session context for follow-up questions
   */
  public async getSessionContext(sessionId: string, contextSize: number = 5): Promise<string> {
    try {
      const recentConversations = await this.getConversationHistory(sessionId, contextSize);
      
      if (recentConversations.length === 0) {
        return '';
      }

      // Build context from recent conversations
      const contextParts = recentConversations.reverse().map(conv => 
        `Q: ${conv.question}\nA: ${conv.answer.substring(0, 200)}...`
      );

      return contextParts.join('\n\n');

    } catch (error) {
      logger.error('Failed to get session context', {
        error: getErrorMessage(error),
        sessionId
      });
      return '';
    }
  }

  /**
   * Clean up expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    try {
      const db = databaseManager.getDatabase();
      
      // Get expired session IDs first
      const expiredSessions = db.prepare(`
        SELECT id FROM sessions WHERE expires_at <= datetime('now')
      `).all() as Array<{ id: string }>;

      if (expiredSessions.length === 0) {
        return 0;
      }

      // Delete conversations for expired sessions
      for (const session of expiredSessions) {
        db.prepare(`DELETE FROM conversations WHERE session_id = ?`).run(session.id);
      }

      // Delete expired sessions
      const result = db.prepare(`
        DELETE FROM sessions WHERE expires_at <= datetime('now')
      `).run();

      logger.info('Cleaned up expired sessions', {
        deletedSessions: result.changes,
        deletedConversations: expiredSessions.length
      });

      return result.changes;

    } catch (error) {
      logger.error('Failed to cleanup expired sessions', {
        error: getErrorMessage(error)
      });
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(): Promise<SessionStats> {
    try {
      const db = databaseManager.getDatabase();

      // Total sessions
      const totalSessions = db.prepare(`SELECT COUNT(*) as count FROM sessions`).get() as any;

      // Active sessions
      const activeSessions = db.prepare(`
        SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime('now')
      `).get() as any;

      // Total conversations
      const totalConversations = db.prepare(`SELECT COUNT(*) as count FROM conversations`).get() as any;

      // Average session duration (in minutes)
      const avgDuration = db.prepare(`
        SELECT AVG(
          (julianday(last_activity) - julianday(created_at)) * 24 * 60
        ) as avg_duration
        FROM sessions
        WHERE last_activity > created_at
      `).get() as any;

      return {
        totalSessions: totalSessions.count,
        activeSessions: activeSessions.count,
        totalConversations: totalConversations.count,
        averageSessionDuration: Math.round(avgDuration.avg_duration || 0),
        topQuestionTypes: [] // Would need to join with question analysis data
      };

    } catch (error) {
      logger.error('Failed to get session stats', {
        error: getErrorMessage(error)
      });
      return {
        totalSessions: 0,
        activeSessions: 0,
        totalConversations: 0,
        averageSessionDuration: 0,
        topQuestionTypes: []
      };
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL);

    logger.info('Session cleanup timer started', {
      intervalMinutes: this.CLEANUP_INTERVAL / (60 * 1000)
    });
  }

  /**
   * Stop cleanup timer
   */
  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      logger.info('Session cleanup timer stopped');
    }
  }

  /**
   * Validate session and return session info
   */
  public async validateSession(sessionId: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (session && session.expiresAt > new Date()) {
      await this.updateSessionActivity(sessionId);
      return session;
    }
    return null;
  }
}

// Create singleton instance
export const sessionManager = new SessionManager();
export default sessionManager;