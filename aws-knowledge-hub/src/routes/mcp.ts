import { Router, Request, Response } from 'express';
import { mcpService } from '../services/mcpService';
import { mcpClient } from '../services/mcpClient';
import { logger } from '../config/logger';
import { getErrorMessage } from '../utils/errorUtils';

const router = Router();

/**
 * Test MCP server connectivity
 */
router.get('/test', async (req: Request, res: Response) => {
  try {
    const result = await mcpService.testConnection();
    
    res.json({
      success: true,
      data: result.data,
      responseTime: result.responseTime,
      timestamp: result.timestamp
    });
  } catch (error) {
    logger.error('MCP test endpoint failed', { error: getErrorMessage(error) });
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Search AWS documentation
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { question, options = {} } = req.body;

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Question is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const result = await mcpService.intelligentSearch(question, options);

    res.json({
      success: result.success,
      data: {
        results: result.results,
        analysis: result.analysis,
        searchStrategy: result.searchStrategy
      },
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MCP search endpoint failed', { 
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
 * Analyze a question without performing search
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

    const analysis = mcpService.analyzeQuestion(question);

    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MCP analyze endpoint failed', { 
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
 * Read specific documentation page
 */
router.post('/read', async (req: Request, res: Response) => {
  try {
    const { url, maxLength } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'URL is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const content = await mcpService.getDocumentationContent(url, maxLength);

    res.json({
      success: true,
      data: content,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MCP read endpoint failed', { 
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
 * Get documentation recommendations
 */
router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'URL is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const recommendations = await mcpService.getRelatedDocumentation(url);

    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MCP recommendations endpoint failed', { 
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
 * Check AWS service regional availability
 */
router.post('/availability', async (req: Request, res: Response) => {
  try {
    const { services, region } = req.body;

    if (!services || !Array.isArray(services) || services.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Services array is required and must not be empty',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!region || typeof region !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Region is required and must be a string',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const availability = await mcpService.checkServiceAvailability(services, region);

    res.json({
      success: true,
      data: availability,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MCP availability endpoint failed', { 
      error: getErrorMessage(error),
      services: req.body?.services,
      region: req.body?.region
    });
    
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get AWS regions list
 */
router.get('/regions', async (req: Request, res: Response) => {
  try {
    const response = await mcpClient.listRegions();

    res.json({
      success: response.success,
      data: response.data,
      error: response.error,
      responseTime: response.responseTime,
      timestamp: response.timestamp
    });

  } catch (error) {
    logger.error('MCP regions endpoint failed', { error: getErrorMessage(error) });
    
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get MCP service statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = mcpService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MCP stats endpoint failed', { error: getErrorMessage(error) });
    
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;