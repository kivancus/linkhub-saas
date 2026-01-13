import { Router, Request, Response } from 'express';
import { answerGeneratorService } from '../services/answerGenerator';
import { documentationSearchService } from '../services/documentationSearch';
import { questionEngine } from '../services/questionEngine';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

const router = Router();

/**
 * Generate a complete answer for a question using search results
 */
router.post('/generate', async (req: Request, res: Response) => {
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

    // First, search for relevant documentation
    const searchResult = await documentationSearchService.search({
      question,
      sessionId,
      options: {
        maxResults: options.maxResults || 5,
        useCache: options.useCache !== false
      }
    });

    if (!searchResult.success || searchResult.results.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No relevant documentation found for the question',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Generate answer from search results
    const answerResult = await answerGeneratorService.generateAnswer({
      question,
      searchResults: searchResult.results,
      questionAnalysis: searchResult.questionAnalysis,
      sessionId,
      options: {
        maxLength: options.maxLength,
        includeCodeExamples: options.includeCodeExamples !== false,
        includeStepByStep: options.includeStepByStep !== false,
        includeReferences: options.includeReferences !== false,
        format: options.format || 'markdown',
        tone: options.tone || 'technical'
      }
    });

    res.json({
      success: answerResult.success,
      data: {
        answer: answerResult,
        searchMetadata: {
          searchId: searchResult.searchId,
          totalSearchResults: searchResult.totalResults,
          searchProcessingTime: searchResult.processingTime
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Answer generation endpoint failed', {
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
 * Generate a quick answer from the top search result
 */
router.post('/quick', async (req: Request, res: Response) => {
  try {
    const { question, sessionId } = req.body;

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

    // Search for the top result
    const searchResult = await documentationSearchService.search({
      question,
      sessionId,
      options: { maxResults: 1, useCache: true }
    });

    if (!searchResult.success || searchResult.results.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No relevant documentation found for the question',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Generate quick answer
    const quickAnswer = await answerGeneratorService.generateQuickAnswer(
      question,
      searchResult.results[0]
    );

    res.json({
      success: true,
      data: {
        question,
        answer: quickAnswer,
        source: {
          url: searchResult.results[0].result.url,
          title: searchResult.results[0].result.title,
          relevanceScore: searchResult.results[0].finalScore
        },
        processingTime: searchResult.processingTime
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Quick answer generation endpoint failed', {
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
 * Complete Q&A pipeline: question processing + search + answer generation + session storage
 */
router.post('/complete', async (req: Request, res: Response) => {
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

    const startTime = Date.now();

    // Import session manager
    const { sessionManager } = await import('../services/sessionManager');

    // Validate session
    const session = await sessionManager.validateSession(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found or expired. Please create a new session.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Step 1: Process and analyze the question
    const questionResult = await questionEngine.processQuestion(question, sessionId, {
      source: 'api'
    });

    if (!questionResult.success) {
      res.status(400).json({
        success: false,
        error: questionResult.error || 'Question processing failed',
        data: {
          questionAnalysis: questionResult.analysis,
          validation: questionResult.validation,
          suggestions: questionResult.suggestions
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Step 2: Search for relevant documentation
    const searchResult = await documentationSearchService.search({
      question,
      sessionId,
      options: {
        maxResults: options.maxSearchResults || 5,
        useCache: options.useCache !== false
      }
    });

    if (!searchResult.success || searchResult.results.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No relevant documentation found',
        data: {
          questionAnalysis: questionResult.analysis,
          searchMetadata: searchResult.metadata
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Step 3: Generate comprehensive answer
    const answerResult = await answerGeneratorService.generateAnswer({
      question,
      searchResults: searchResult.results,
      questionAnalysis: searchResult.questionAnalysis,
      sessionId,
      options: {
        maxLength: options.maxLength,
        includeCodeExamples: options.includeCodeExamples !== false,
        includeStepByStep: options.includeStepByStep !== false,
        includeReferences: options.includeReferences !== false,
        format: options.format || 'markdown',
        tone: options.tone || 'technical'
      }
    });

    const totalProcessingTime = Date.now() - startTime;

    // Step 4: Store conversation in session history
    if (answerResult.success) {
      try {
        await sessionManager.storeConversation(
          sessionId,
          questionResult.question.id,
          question,
          answerResult.answer,
          answerResult.confidence,
          answerResult.sources.map(s => s.url),
          totalProcessingTime
        );
      } catch (error) {
        logger.warn('Failed to store conversation in session', {
          error: getErrorMessage(error),
          sessionId,
          questionId: questionResult.question.id
        });
        // Don't fail the request if storage fails
      }
    }

    res.json({
      success: answerResult.success,
      data: {
        question,
        answer: answerResult.answer,
        confidence: answerResult.confidence,
        sources: answerResult.sources,
        metadata: {
          ...answerResult.metadata,
          pipeline: {
            questionProcessingTime: questionResult.processingTime,
            searchProcessingTime: searchResult.processingTime,
            answerProcessingTime: answerResult.processingTime,
            totalProcessingTime
          },
          questionAnalysis: questionResult.analysis,
          searchStrategy: searchResult.searchStrategy,
          sessionInfo: {
            sessionId,
            conversationStored: true
          }
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Complete Q&A pipeline failed', {
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
 * Test answer generation with sample questions
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const testQuestions = [
      'How do I create an S3 bucket with versioning enabled?',
      'What causes Lambda timeout errors?',
      'How to set up VPC peering?',
      'What is the difference between EC2 and Lambda?',
      'How to troubleshoot DynamoDB performance issues?'
    ];

    const testResults = [];
    const testSessionId = `test-answer-${Date.now()}`;

    for (const question of testQuestions) {
      try {
        // Step 1: Search for documentation
        const searchResult = await documentationSearchService.search({
          question,
          sessionId: testSessionId,
          options: { maxResults: 3, useCache: false }
        });

        if (searchResult.success && searchResult.results.length > 0) {
          // Step 2: Generate answer
          const answerResult = await answerGeneratorService.generateAnswer({
            question,
            searchResults: searchResult.results,
            questionAnalysis: searchResult.questionAnalysis,
            sessionId: testSessionId,
            options: { format: 'markdown' }
          });

          testResults.push({
            question,
            success: answerResult.success,
            answerLength: answerResult.answer.length,
            confidence: answerResult.confidence,
            sourceCount: answerResult.sources.length,
            processingTime: answerResult.processingTime + searchResult.processingTime,
            questionType: searchResult.questionAnalysis.questionType,
            error: answerResult.error || null
          });
        } else {
          testResults.push({
            question,
            success: false,
            answerLength: 0,
            confidence: 0,
            sourceCount: 0,
            processingTime: searchResult.processingTime,
            questionType: 'unknown',
            error: searchResult.error || 'No search results found'
          });
        }
      } catch (error) {
        testResults.push({
          question,
          success: false,
          answerLength: 0,
          confidence: 0,
          sourceCount: 0,
          processingTime: 0,
          questionType: 'unknown',
          error: getErrorMessage(error)
        });
      }
    }

    const successfulResults = testResults.filter(r => r.success);
    const summary = {
      totalQuestions: testResults.length,
      successfulAnswers: successfulResults.length,
      averageProcessingTime: testResults.reduce((sum, r) => sum + r.processingTime, 0) / testResults.length,
      averageConfidence: successfulResults.length > 0 ? 
        successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length : 0,
      averageAnswerLength: successfulResults.length > 0 ? 
        successfulResults.reduce((sum, r) => sum + r.answerLength, 0) / successfulResults.length : 0,
      questionTypes: [...new Set(testResults.map(r => r.questionType))],
      successRate: (successfulResults.length / testResults.length) * 100
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
    logger.error('Answer generation test endpoint failed', {
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
 * Get answer generation service statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = answerGeneratorService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Answer generation stats endpoint failed', {
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