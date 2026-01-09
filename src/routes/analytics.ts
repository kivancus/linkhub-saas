import express from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { ValidationError } from '../utils/errors';

const router = express.Router();
const analyticsService = new AnalyticsService();

// Get analytics summary (last 30 days, 7 days, today)
router.get('/summary', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
      return;
    }

    const summary = await analyticsService.getAnalyticsSummary(req.user.id);

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Get analytics summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get analytics summary'
      }
    });
  }
});

// Get detailed analytics with custom date range
router.get('/detailed', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication required'
        }
      });
      return;
    }

    const { startDate, endDate, period } = req.query;

    // Validate and parse dates
    const filters: any = {};
    
    if (startDate) {
      const parsedStartDate = new Date(startDate as string);
      if (isNaN(parsedStartDate.getTime())) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid start date format',
            field: 'startDate'
          }
        });
        return;
      }
      filters.startDate = parsedStartDate;
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate as string);
      if (isNaN(parsedEndDate.getTime())) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid end date format',
            field: 'endDate'
          }
        });
        return;
      }
      filters.endDate = parsedEndDate;
    }

    if (period && !['day', 'week', 'month'].includes(period as string)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Period must be one of: day, week, month',
          field: 'period'
        }
      });
      return;
    }

    if (period) {
      filters.period = period;
    }

    const analytics = await analyticsService.getBioPageAnalytics(req.user.id, filters);

    res.json({
      success: true,
      data: { 
        analytics,
        filters: {
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
          period: filters.period
        }
      }
    });
  } catch (error) {
    console.error('Get detailed analytics error:', error);

    if (error instanceof ValidationError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.field && { field: error.field })
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get analytics data'
      }
    });
  }
});

export default router;