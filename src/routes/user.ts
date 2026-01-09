import express from 'express';
import prisma from '../config/database';
import { UserService } from '../services/userService';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { ValidationError, ConflictError } from '../utils/errors';

const router = express.Router();
const userService = new UserService();

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const user = await userService.getUserById(req.user.id);

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user profile'
      }
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { profileName, profileBio, profileImageUrl } = req.body;

    const updates: any = {};
    if (profileName !== undefined) updates.profileName = profileName;
    if (profileBio !== undefined) updates.profileBio = profileBio;
    if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl;

    const user = await userService.updateProfile(req.user.id, updates);

    res.json({
      success: true,
      data: {
        user,
        message: 'Profile updated successfully!'
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error instanceof ValidationError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update profile'
      }
    });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        profileName: true,
        profileBio: true,
        profileImageUrl: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user profile'
      }
    });
  }
});

// Claim username
router.post('/claim-username', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { username } = req.body;

    if (!username) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username is required',
          field: 'username'
        }
      });
      return;
    }

    const user = await userService.claimUsername(req.user.id, username);

    res.json({
      success: true,
      data: {
        user,
        message: `Username "${username}" claimed successfully!`
      }
    });
  } catch (error) {
    console.error('Claim username error:', error);

    if (error instanceof ValidationError || error instanceof ConflictError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to claim username'
      }
    });
  }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Validate username format
    const { validateUsername } = await import('../utils/validation');
    const validation = validateUsername(username);
    
    if (!validation.isValid) {
      res.json({
        success: true,
        data: {
          available: false,
          reason: validation.errors[0]
        }
      });
      return;
    }

    // Check if username exists
    const prisma = (await import('../config/database')).default;
    
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    res.json({
      success: true,
      data: {
        available: !user,
        reason: user ? 'Username already taken' : undefined
      }
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to check username availability'
      }
    });
  }
});

export default router;