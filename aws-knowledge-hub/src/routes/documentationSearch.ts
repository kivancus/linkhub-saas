import { Router, Request, Response } from 'express';
import { documentationSearchService } from '../services/documentationSearch';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

// Inline type definition
interface DocumentationSearchRequest {
  question: string;
  sessionId: string;
  options?: {
    maxResults?: number;
    timeout?: number;
    useCache?: boolean;
    parallelSearch?: boolean;
    topics?: any[];
    includeRelated?: boolean;
  };
}

const router = Router();

/**
 * Search AWS documentation with intelligent ranking and caching
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { question, sessionId, options = {} } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Session ID is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const searchRequest: DocumentationSearchRequest = {
      question,
      sessionId,
      options: {
        maxResults: options.maxResults || 10,
        timeout: options.timeout || 30000,
        useCache: options.useCache !== false,
        parallelSearch: options.parallelSearch !== false,
        topics: options.topics,
        includeRelated: options.includeRelated || false
      }
    };

    const result = await documentationSearchService.search(searchRequest);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Documentation search endpoint failed', {
      error: getErrorMessage(error),
      question: req.body?.question?.substring(0, 100),
      sessionId: req.body?.sessionId
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get search suggestions based on partial input
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { partialQuestion, sessionId, limit = 5 } = req.body;

    if (!partialQuestion || typeof partialQuestion !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Partial question is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Session ID is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const suggestions = await documentationSearchService.getSuggestions(
      partialQuestion,
      sessionId,
      Math.min(Math.max(limit, 1), 20) // Limit between 1 and 20
    );

    res.json({
      success: true,
      data: {
        suggestions,
        partialQuestion,
        count: suggestions.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Search suggestions endpoint failed', {
      error: getErrorMessage(error),
      partialQuestion: req.body?.partialQuestion?.substring(0, 50),
      sessionId: req.body?.sessionId
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get related documentation for a specific URL
 */
router.post('/related', async (req: Request, res: Response) => {
  try {
    const { url, limit = 5 } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'URL is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const relatedDocs = await documentationSearchService.getRelatedDocumentation(
      url,
      Math.min(Math.max(limit, 1), 20) // Limit between 1 and 20
    );

    res.json({
      success: true,
      data: {
        url,
        relatedDocumentation: relatedDocs,
        count: relatedDocs.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Related documentation endpoint failed', {
      error: getErrorMessage(error),
      url: req.body?.url
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Clear search cache
 */
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    documentationSearchService.clearCache();

    res.json({
      success: true,
      data: {
        message: 'Search cache cleared successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Clear cache endpoint failed', {
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
 * Get search cache statistics
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const cacheStats = documentationSearchService.getCacheStats();

    res.json({
      success: true,
      data: cacheStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Cache stats endpoint failed', {
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
 * Test documentation search with sample queries
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const testQueries = [
      'How do I create an S3 bucket with versioning enabled?',
      'Lambda function timeout error when connecting to RDS',
      'What are the differences between EC2 instance types?',
      'How to set up VPC peering between regions?',
      'Best practices for DynamoDB table design'
    ];

    const testResults = [];
    const testSessionId = `test-session-${Date.now()}`;

    for (const question of testQueries) {
      const searchRequest: DocumentationSearchRequest = {
        question,
        sessionId: testSessionId,
        options: {
          maxResults: 5,
          timeout: 15000,
          useCache: false // Don't use cache for tests
        }
      };

      const result = await documentationSearchService.search(searchRequest);
      
      testResults.push({
        question,
        success: result.success,
        resultCount: result.results.length,
        processingTime: result.processingTime,
        questionType: result.questionAnalysis.questionType,
        awsServices: result.questionAnalysis.awsServices.map((s: any) => s.serviceName),
        searchTopics: result.searchStrategy.primaryTopics,
        cached: result.cached,
        error: result.error
      });
    }

    const summary = {
      totalQueries: testResults.length,
      successfulQueries: testResults.filter(r => r.success).length,
      averageProcessingTime: testResults.reduce((sum, r) => sum + r.processingTime, 0) / testResults.length,
      averageResultCount: testResults.reduce((sum, r) => sum + r.resultCount, 0) / testResults.length,
      questionTypes: [...new Set(testResults.map(r => r.questionType))],
      uniqueAwsServices: [...new Set(testResults.flatMap(r => r.awsServices))]
    };

    res.json({
      success: true,
      data: {
        testResults,
        summary
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Documentation search test endpoint failed', {
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
 * Get search performance statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // This would typically query the database for analytics
    // For now, return basic cache stats
    const cacheStats = documentationSearchService.getCacheStats();

    res.json({
      success: true,
      data: {
        cache: cacheStats,
        // Additional stats would be added here from database queries
        message: 'Full analytics implementation pending database queries'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Search stats endpoint failed', {
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