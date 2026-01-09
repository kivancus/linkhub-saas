import express from 'express';
import prisma from '../config/database';

const router = express.Router();

// Get all available themes
router.get('/', async (_req, res) => {
  try {
    const themes = await prisma.theme.findMany({
      select: {
        id: true,
        name: true,
        isPremium: true,
        previewImageUrl: true,
        colorVariables: true,
      },
      orderBy: [
        { isPremium: 'asc' }, // Free themes first
        { name: 'asc' }
      ]
    });

    // Parse colorVariables JSON strings back to arrays
    const themesWithParsedColors = themes.map(theme => ({
      ...theme,
      colorVariables: JSON.parse(theme.colorVariables)
    }));

    res.json({
      success: true,
      data: {
        themes: themesWithParsedColors,
        counts: {
          total: themes.length,
          free: themes.filter(t => !t.isPremium).length,
          premium: themes.filter(t => t.isPremium).length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching themes:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch themes',
        code: 'THEMES_FETCH_ERROR'
      }
    });
  }
});

// Get a specific theme by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const theme = await prisma.theme.findUnique({
      where: { id }
    });

    if (!theme) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Theme not found',
          code: 'THEME_NOT_FOUND'
        }
      });
      return;
    }

    // Parse colorVariables JSON string back to array
    const themeWithParsedColors = {
      ...theme,
      colorVariables: JSON.parse(theme.colorVariables)
    };

    res.json({
      success: true,
      data: themeWithParsedColors
    });
  } catch (error) {
    console.error('Error fetching theme:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch theme',
        code: 'THEME_FETCH_ERROR'
      }
    });
  }
});

export default router;