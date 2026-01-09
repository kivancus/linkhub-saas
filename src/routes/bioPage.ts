import express from 'express';
import { BioPageService } from '../services/bioPageService';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/errors';

const router = express.Router();
const bioPageService = new BioPageService();

// Get user's bio page
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    let bioPage = await bioPageService.getBioPageByUserId(req.user.id);

    // Create bio page if it doesn't exist
    if (!bioPage) {
      bioPage = await bioPageService.createBioPage(req.user.id);
    }

    res.json({
      success: true,
      data: { bioPage }
    });
  } catch (error) {
    console.error('Get bio page error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get bio page'
      }
    });
  }
});

// Update bio page settings
router.put('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { themeId, customColors, isPublished } = req.body;

    const updates: any = {};
    if (themeId !== undefined) updates.themeId = themeId;
    if (customColors !== undefined) updates.customColors = customColors;
    if (isPublished !== undefined) updates.isPublished = isPublished;

    const bioPage = await bioPageService.updateBioPage(req.user.id, updates);

    res.json({
      success: true,
      data: {
        bioPage,
        message: 'Bio page updated successfully!'
      }
    });
  } catch (error) {
    console.error('Update bio page error:', error);

    if (error instanceof ValidationError || error instanceof AuthorizationError) {
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
        message: 'Failed to update bio page'
      }
    });
  }
});

// Add new link
router.post('/links', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { title, url, iconName } = req.body;

    if (!title || !url) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title and URL are required'
        }
      });
      return;
    }

    const bioPage = await bioPageService.addLink(req.user.id, { title, url, iconName });

    res.status(201).json({
      success: true,
      data: {
        bioPage,
        message: 'Link added successfully!'
      }
    });
  } catch (error) {
    console.error('Add link error:', error);

    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AuthorizationError) {
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
        message: 'Failed to add link'
      }
    });
  }
});

// Update link
router.put('/links/:linkId', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { linkId } = req.params;
    
    if (!linkId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Link ID is required'
        }
      });
      return;
    }

    const { title, url, iconName, isActive } = req.body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (url !== undefined) updates.url = url;
    if (iconName !== undefined) updates.iconName = iconName;
    if (isActive !== undefined) updates.isActive = isActive;

    const bioPage = await bioPageService.updateLink(req.user.id, linkId, updates);

    res.json({
      success: true,
      data: {
        bioPage,
        message: 'Link updated successfully!'
      }
    });
  } catch (error) {
    console.error('Update link error:', error);

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
        message: 'Failed to update link'
      }
    });
  }
});

// Delete link
router.delete('/links/:linkId', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { linkId } = req.params;
    
    if (!linkId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Link ID is required'
        }
      });
      return;
    }

    const bioPage = await bioPageService.deleteLink(req.user.id, linkId);

    res.json({
      success: true,
      data: {
        bioPage,
        message: 'Link deleted successfully!'
      }
    });
  } catch (error) {
    console.error('Delete link error:', error);

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
        message: 'Failed to delete link'
      }
    });
  }
});

// Reorder links
router.put('/links/reorder', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { linkIds } = req.body;

    if (!Array.isArray(linkIds)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'linkIds must be an array',
          field: 'linkIds'
        }
      });
      return;
    }

    const bioPage = await bioPageService.reorderLinks(req.user.id, linkIds);

    res.json({
      success: true,
      data: {
        bioPage,
        message: 'Links reordered successfully!'
      }
    });
  } catch (error) {
    console.error('Reorder links error:', error);

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
        message: 'Failed to reorder links'
      }
    });
  }
});

export default router;