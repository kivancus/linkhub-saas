import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import database
import prisma from './config/database';
import logger from './utils/logger';
import { checkHealth } from './utils/healthCheck';
import { requestLogger, errorTracker, performanceMonitor } from './middleware/monitoring';

// Import routes (will be created in subsequent tasks)
import themeRoutes from './routes/themes';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import bioPageRoutes from './routes/bioPage';
import publicRoutes from './routes/public';
import analyticsRoutes from './routes/analytics';
import subscriptionRoutes from './routes/subscription';
import webhookRoutes from './routes/webhooks';
// import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env['PORT'] || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Webhooks (must come before body parsing middleware)
app.use('/api/webhooks', webhookRoutes);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env['NODE_ENV'] !== 'test') {
  app.use(requestLogger);
  app.use(performanceMonitor);
  if (process.env['NODE_ENV'] === 'development') {
    app.use(morgan('combined'));
  }
}

// Static file serving for uploads and public files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Welcome page for development - redirect to dashboard
app.get('/', (_req, res) => {
  res.redirect('/index.html');
});

// API routes (will be uncommented as routes are created)
app.use('/api/themes', themeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/bio-page', bioPageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscription', subscriptionRoutes);

// Public bio page API endpoint
app.get('/api/bio-page/public/:username', async (req, res) => {
  try {
    const { username } = req.params;

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
    console.error('Error fetching public bio page:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load bio page'
      }
    });
  }
});

// app.use('/api/admin', adminRoutes);

// Public bio page routes (must come after API routes)
app.use('/', publicRoutes);

// Serve React app in production
if (process.env['NODE_ENV'] === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Handle React Router routes
  app.get('*', (req, res) => {
    // Skip API routes and public bio pages
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Global error handler
app.use(errorTracker);
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Global error handler', { error: err.message, stack: err.stack });
  
  // Don't leak error details in production
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(isDevelopment && { stack: err.stack }),
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      path: req.originalUrl,
    },
  });
});

// Start server
if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, () => {
    logger.info('LinkHub server started', {
      port: PORT,
      environment: process.env['NODE_ENV'],
      nodeVersion: process.version,
    });
    console.log(`🚀 LinkHub server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env['NODE_ENV']}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await prisma.$disconnect();
    process.exit(0);
  });
}

export default app;