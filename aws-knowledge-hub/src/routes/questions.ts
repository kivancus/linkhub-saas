import { Router, Request, Response } from 'express';
import { questionEngine } from '../services/questionEngine';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

const router = Router();

/**
 * Process a question through the complete analysis pipeline
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { question, sessionId, metadata = {} } = req.body;

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

    // Add request metadata
    const requestMetadata = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      source: 'api',
      ...metadata
    };

    const result = await questionEngine.processQuestion(question, sessionId, requestMetadata);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Question processing endpoint failed', {
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
 * Validate a question without full processing
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Use the private validation method through a minimal processing
    const result = await questionEngine.processQuestion(question, 'validation-only', {});
    
    res.json({
      success: true,
      data: {
        validation: result.validation,
        normalization: result.normalization,
        suggestions: result.suggestions
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Question validation endpoint failed', {
      error: getErrorMessage(error),
      question: req.body?.question?.substring(0, 100)
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Analyze a question to extract AWS services and classify type
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const result = await questionEngine.processQuestion(question, 'analysis-only', {});

    res.json({
      success: result.success,
      data: {
        analysis: result.analysis,
        validation: result.validation,
        processingTime: result.processingTime
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Question analysis endpoint failed', {
      error: getErrorMessage(error),
      question: req.body?.question?.substring(0, 100)
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Normalize question text (spelling, abbreviations, formatting)
 */
router.post('/normalize', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const result = await questionEngine.processQuestion(question, 'normalize-only', {});

    res.json({
      success: true,
      data: {
        normalization: result.normalization,
        validation: result.validation
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Question normalization endpoint failed', {
      error: getErrorMessage(error),
      question: req.body?.question?.substring(0, 100)
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get suggestions for improving a question
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const result = await questionEngine.processQuestion(question, 'suggestions-only', {});

    res.json({
      success: true,
      data: {
        suggestions: result.suggestions,
        validation: result.validation,
        analysis: result.analysis
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Question suggestions endpoint failed', {
      error: getErrorMessage(error),
      question: req.body?.question?.substring(0, 100)
    });

    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get question engine statistics and configuration
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = questionEngine.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Question engine stats endpoint failed', {
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
 * Test question engine with sample questions
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const testQuestions = [
      'How do I create an S3 bucket?',
      'Lambda function timeout error with DynamoDB',
      'What is the difference between EC2 and Lambda?',
      'How to secure my VPC with IAM policies?',
      'Best practices for CloudFormation templates'
    ];

    const results = [];
    
    for (const question of testQuestions) {
      const result = await questionEngine.processQuestion(question, 'test-session', {
        source: 'test'
      });
      
      results.push({
        question,
        questionType: result.analysis.questionType,
        awsServices: result.analysis.awsServices.map(s => s.serviceName),
        complexity: result.analysis.complexity,
        confidence: result.analysis.confidence,
        isValid: result.validation.isValid,
        processingTime: result.processingTime
      });
    }

    res.json({
      success: true,
      data: {
        testResults: results,
        summary: {
          totalQuestions: results.length,
          averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
          averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
          validQuestions: results.filter(r => r.isValid).length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Question engine test endpoint failed', {
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