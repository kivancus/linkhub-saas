import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/sessionManager';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

const router = Router();

/**
 * Create a new session
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { userId, preferences = {} } = req.body;

    const metadata = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      source: 'api',
      userId,
      preferences
    };

    const session = await sessionManager.createSession(metadata);

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Session creation failed', {
      error: getErrorMessage(error)
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get session information
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found or expired',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        metadata: session.metadata
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get session failed', {
      error: getErrorMessage(error),
      sessionId: req.params.sessionId
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Delete a session
 */
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const deleted = await sessionManager.deleteSession(sessionId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Session deleted successfully',
        sessionId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Delete session failed', {
      error: getErrorMessage(error),
      sessionId: req.params.sessionId
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get conversation history for a session
 */
router.get('/:sessionId/history', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate session exists
    const session = await sessionManager.validateSession(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found or expired',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const history = await sessionManager.getConversationHistory(sessionId, limit, offset);

    res.json({
      success: true,
      data: {
        sessionId,
        conversations: history,
        count: history.length,
        limit,
        offset
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get conversation history failed', {
      error: getErrorMessage(error),
      sessionId: req.params.sessionId
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Search conversations in a session
 */
router.get('/:sessionId/search', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { q: searchTerm } = req.query;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!searchTerm || typeof searchTerm !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search term (q) is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate session exists
    const session = await sessionManager.validateSession(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found or expired',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const results = await sessionManager.searchConversations(sessionId, searchTerm, limit);

    res.json({
      success: true,
      data: {
        sessionId,
        searchTerm,
        results,
        count: results.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Search conversations failed', {
      error: getErrorMessage(error),
      sessionId: req.params.sessionId,
      searchTerm: req.query.q
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get session context for follow-up questions
 */
router.get('/:sessionId/context', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const contextSize = parseInt(req.query.size as string) || 5;

    // Validate session exists
    const session = await sessionManager.validateSession(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found or expired',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const context = await sessionManager.getSessionContext(sessionId, contextSize);

    res.json({
      success: true,
      data: {
        sessionId,
        context,
        contextSize
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get session context failed', {
      error: getErrorMessage(error),
      sessionId: req.params.sessionId
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get session statistics
 */
router.get('/admin/stats', async (req: Request, res: Response) => {
  try {
    const stats = await sessionManager.getSessionStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get session stats failed', {
      error: getErrorMessage(error)
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Manually trigger cleanup of expired sessions
 */
router.post('/admin/cleanup', async (req: Request, res: Response) => {
  try {
    const deletedCount = await sessionManager.cleanupExpiredSessions();

    res.json({
      success: true,
      data: {
        message: 'Cleanup completed',
        deletedSessions: deletedCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Manual session cleanup failed', {
      error: getErrorMessage(error)
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;