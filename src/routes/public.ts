import express from 'express';
import path from 'path';
import prisma from '../config/database';
import { hashIP } from '../utils/crypto';

const router = express.Router();

// Get public bio page by username
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Check if this is a request for the HTML page (from browser)
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    
    if (acceptsHtml) {
      // Serve the bio page HTML template
      res.sendFile(path.join(__dirname, '../../public/bio.html'));
      return;
    }

    // API request - return JSON data
    // Find user and their bio page
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: {
        bioPage: {
          include: {
            links: {
              where: { isActive: true },
              orderBy: { orderIndex: 'asc' }
            },
            theme: true
          }
        }
      }
    });

    if (!user || !user.bioPage || !user.bioPage.isPublished) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PAGE_NOT_FOUND',
          message: 'Bio page not found'
        }
      });
      return;
    }

    // Record page view for analytics
    const visitorIP = req.ip || req.connection.remoteAddress || 'unknown';
    const visitorIPHash = hashIP(visitorIP);
    const userAgent = req.get('User-Agent') || '';
    const referrer = req.get('Referer') || null;

    // Record analytics event (fire and forget)
    prisma.analyticsEvent.create({
      data: {
        bioPageId: user.bioPage.id,
        userId: user.id,
        eventType: 'page_view',
        visitorIpHash: visitorIPHash,
        userAgent,
        referrer
      }
    }).catch(error => {
      console.error('Failed to record page view:', error);
    });

    // Parse custom colors if they exist
    let customColors = null;
    if (user.bioPage.customColors) {
      try {
        customColors = JSON.parse(user.bioPage.customColors);
      } catch (error) {
        console.error('Failed to parse custom colors:', error);
      }
    }

    // Parse theme color variables
    let themeColorVariables = [];
    try {
      themeColorVariables = JSON.parse(user.bioPage.theme.colorVariables);
    } catch (error) {
      console.error('Failed to parse theme color variables:', error);
    }

    // Return bio page data
    res.json({
      success: true,
      data: {
        user: {
          username: user.username,
          profileName: user.profileName,
          profileBio: user.profileBio,
          profileImageUrl: user.profileImageUrl
        },
        bioPage: {
          id: user.bioPage.id,
          themeId: user.bioPage.themeId,
          customColors,
          links: user.bioPage.links,
          createdAt: user.bioPage.createdAt,
          updatedAt: user.bioPage.updatedAt
        },
        theme: {
          id: user.bioPage.theme.id,
          name: user.bioPage.theme.name,
          isPremium: user.bioPage.theme.isPremium,
          cssTemplate: user.bioPage.theme.cssTemplate,
          colorVariables: themeColorVariables
        }
      }
    });
  } catch (error) {
    console.error('Error fetching bio page:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load bio page'
      }
    });
  }
});

// Record link click and redirect
router.get('/:username/link/:linkId', async (req, res) => {
  try {
    const { username, linkId } = req.params;

    // Find user, bio page, and link
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: {
        bioPage: {
          include: {
            links: {
              where: { 
                id: linkId,
                isActive: true 
              }
            }
          }
        }
      }
    });

    if (!user || !user.bioPage || !user.bioPage.isPublished) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PAGE_NOT_FOUND',
          message: 'Bio page not found'
        }
      });
      return;
    }

    const link = user.bioPage.links[0];
    if (!link) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LINK_NOT_FOUND',
          message: 'Link not found'
        }
      });
      return;
    }

    // Record link click for analytics
    const visitorIP = req.ip || req.connection.remoteAddress || 'unknown';
    const visitorIPHash = hashIP(visitorIP);
    const userAgent = req.get('User-Agent') || '';
    const referrer = req.get('Referer') || null;

    // Record analytics event (fire and forget)
    prisma.analyticsEvent.create({
      data: {
        bioPageId: user.bioPage.id,
        userId: user.id,
        eventType: 'link_click',
        linkId: link.id,
        visitorIpHash: visitorIPHash,
        userAgent,
        referrer
      }
    }).catch(error => {
      console.error('Failed to record link click:', error);
    });

    // Redirect to the target URL
    res.redirect(302, link.url);
  } catch (error) {
    console.error('Error processing link click:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process link click'
      }
    });
  }
});

export default router;