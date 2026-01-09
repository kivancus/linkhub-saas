import express from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = express.Router();
const subscriptionService = new SubscriptionService();

// Get available subscription plans
router.get('/plans', async (_req, res) => {
  try {
    const plans = subscriptionService.getPlans();
    
    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get subscription plans'
      }
    });
  }
});

// Get user's current subscription
router.get('/current', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const subscription = await subscriptionService.getUserSubscription(req.user.id);
    
    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Get current subscription error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get subscription'
      }
    });
  }
});

// Create checkout session for subscription
router.post('/checkout', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { planId, successUrl, cancelUrl } = req.body;

    if (!planId || !successUrl || !cancelUrl) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'planId, successUrl, and cancelUrl are required'
        }
      });
      return;
    }

    const session = await subscriptionService.createCheckoutSession(
      req.user.id,
      planId,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      data: { session }
    });
  } catch (error) {
    console.error('Create checkout session error:', error);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof ValidationError && error.field && { field: error.field })
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create checkout session'
      }
    });
  }
});

// Handle successful payment
router.post('/success', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sessionId is required'
        }
      });
      return;
    }

    const result = await subscriptionService.handleSuccessfulPayment(sessionId);

    res.json({
      success: true,
      data: result,
      message: 'Subscription activated successfully!'
    });
  } catch (error) {
    console.error('Handle successful payment error:', error);

    if (error instanceof ValidationError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process payment'
      }
    });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const result = await subscriptionService.cancelSubscription(req.user.id);

    res.json({
      success: true,
      data: result,
      message: 'Subscription will be cancelled at the end of the current period'
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);

    if (error instanceof NotFoundError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to cancel subscription'
      }
    });
  }
});

// Reactivate subscription
router.post('/reactivate', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const result = await subscriptionService.reactivateSubscription(req.user.id);

    res.json({
      success: true,
      data: result,
      message: 'Subscription reactivated successfully!'
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);

    if (error instanceof NotFoundError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reactivate subscription'
      }
    });
  }
});

export default router;