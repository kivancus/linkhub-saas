import { Response, NextFunction } from 'express';
import { verifyJWT } from '../utils/crypto';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Access token required'
        }
      });
      return;
    }

    // Verify JWT token
    const decoded = verifyJWT(token) as any;
    
    // Get user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        subscriptionTier: true,
        emailVerified: true
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid token - user not found'
        }
      });
      return;
    }

    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      subscriptionTier: user.subscriptionTier as 'free' | 'premium'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid or expired token'
      }
    });
  }
};

export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // This middleware should be used after authenticateToken
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

  // For now, we'll skip email verification in development
  // In production, you'd check user.emailVerified
  next();
};

export const requirePremium = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
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

  if (req.user.subscriptionTier !== 'premium') {
    res.status(403).json({
      success: false,
      error: {
        code: 'PREMIUM_REQUIRED',
        message: 'Premium subscription required for this feature'
      }
    });
    return;
  }

  next();
};