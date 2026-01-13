import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { databaseManager } from './database/connection';
import { seedDatabase } from './database/seed';
import { getErrorMessage } from './utils/errorUtils';
import mcpRoutes from './routes/mcp';
import questionRoutes from './routes/questions';
import documentationSearchRoutes from './routes/documentationSearch';
import answerGenerationRoutes from './routes/answerGeneration';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5000;

// Initialize database
const initializeDatabase = async () => {
  try {
    await databaseManager.initialize();
    
    // Seed database in development
    if (process.env.NODE_ENV === 'development') {
      await seedDatabase();
    }
    
    logger.info('Database initialization completed');
  } catch (error) {
    logger.error('Database initialization failed', { error: getErrorMessage(error) });
    process.exit(1);
  }
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP completely for now
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  const dbHealth = databaseManager.healthCheck();
  
  res.status(dbHealth.status === 'healthy' ? 200 : 503).json({ 
    status: dbHealth.status === 'healthy' ? 'OK' : 'ERROR',
    timestamp: new Date().toISOString(),
    service: 'AWS Knowledge Hub API',
    database: dbHealth
  });
});

// Database stats endpoint
app.get('/api/stats', (req, res) => {
  try {
    const stats = databaseManager.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
      timestamp: new Date().toISOString()
    });
  }
});

// Serve static files from public directory
app.use(express.static('public'));

// Serve the chat interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/complete.html'));
});

// Server-side Q&A endpoint that returns HTML
app.post('/ask', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.redirect('/?error=Please enter a question');
    }

    // Import session manager and answer generator directly
    const { sessionManager } = await import('./services/sessionManager');
    const { documentationSearchService } = await import('./services/documentationSearch');
    const { answerGeneratorService } = await import('./services/answerGenerator');
    const { questionEngine } = await import('./services/questionEngine');

    // Create session
    const session = await sessionManager.createSession({
      source: 'web-form',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

    // Process question
    const questionResult = await questionEngine.processQuestion(question, session.id, {
      source: 'api'
    });

    if (!questionResult.success) {
      return res.redirect(`/?error=${encodeURIComponent(questionResult.error || 'Question processing failed')}`);
    }

    // Search for documentation
    const searchResult = await documentationSearchService.search({
      question,
      sessionId: session.id,
      options: { maxResults: 5, useCache: true }
    });

    if (!searchResult.success || searchResult.results.length === 0) {
      return res.redirect(`/?error=${encodeURIComponent('No relevant documentation found')}`);
    }

    // Generate answer
    const answerResult = await answerGeneratorService.generateAnswer({
      question,
      searchResults: searchResult.results,
      questionAnalysis: searchResult.questionAnalysis,
      sessionId: session.id,
      options: { format: 'markdown' }
    });

    if (!answerResult.success) {
      return res.redirect(`/?error=${encodeURIComponent(answerResult.error || 'Answer generation failed')}`);
    }

    const answer = answerResult.answer;
    const sources = answerResult.sources || [];
    const processingTime = answerResult.processingTime + searchResult.processingTime;
    
    // Store conversation
    await sessionManager.storeConversation(
      session.id,
      questionResult.question.id,
      question,
      answer,
      answerResult.confidence,
      sources.map(s => s.url),
      processingTime
    );
    
    // Return HTML with the answer
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS Knowledge Hub - Answer</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); margin: 20px 0; }
        h1 { color: #232f3e; text-align: center; }
        .question { background: linear-gradient(135deg, #007dbc 0%, #005a8b 100%); color: white; padding: 20px; border-radius: 15px; margin: 20px 0; }
        .answer { background: #f8f9fa; padding: 25px; border-radius: 15px; margin: 20px 0; line-height: 1.6; border-left: 4px solid #667eea; }
        .sources { background: #e8f4f8; padding: 20px; border-radius: 15px; margin: 20px 0; }
        .sources a { color: #007dbc; text-decoration: none; display: block; margin: 8px 0; padding: 8px; background: white; border-radius: 8px; }
        .sources a:hover { text-decoration: underline; background: #f0f0f0; }
        .meta { color: #666; font-size: 14px; text-align: center; margin: 15px 0; background: #f8f9fa; padding: 10px; border-radius: 10px; }
        .back-btn { display: inline-block; background: linear-gradient(135deg, #ff9900 0%, #ff7700 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; font-weight: 600; transition: all 0.3s ease; }
        .back-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 153, 0, 0.3); }
        code { background: #f0f0f0; padding: 3px 8px; border-radius: 4px; font-family: Monaco, monospace; }
        pre { background: #f8f9fa; padding: 20px; border-radius: 10px; overflow-x: auto; border-left: 4px solid #28a745; }
        h3, h4 { color: #232f3e; margin-top: 25px; }
        strong { color: #232f3e; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 AWS Knowledge Hub</h1>
        
        <div class="question">
            <strong>📝 Your Question:</strong><br><br>
            ${question}
        </div>
        
        <div class="answer">
            <strong>🤖 AWS Assistant Answer:</strong><br><br>
            ${answer
              .replace(/\n/g, '<br>')
              .replace(/## (.*)/g, '<h3>$1</h3>')
              .replace(/### (.*)/g, '<h4>$1</h4>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code>$1</code>')
              .replace(/```([\\s\\S]*?)```/g, '<pre><code>$1</code></pre>')
            }
        </div>
        
        ${sources.length > 0 ? `
        <div class="sources">
            <strong>📚 Official AWS Documentation Sources:</strong><br><br>
            ${sources.map(source => `<a href="${source.url}" target="_blank">📄 ${source.title || source.url}</a>`).join('')}
        </div>
        ` : ''}
        
        <div class="meta">
            ⚡ Processed in ${processingTime}ms | 
            🎯 Confidence: ${Math.round(answerResult.confidence * 100)}% | 
            📊 Session: ${session.id.substring(0, 8)}... | 
            🔍 Sources: ${sources.length}
        </div>
        
        <div style="text-align: center;">
            <a href="/" class="back-btn">← Ask Another Question</a>
        </div>
    </div>
</body>
</html>
    `;
    res.send(html);
    
  } catch (error) {
    logger.error('Server-side Q&A failed', { error: getErrorMessage(error) });
    res.redirect(`/?error=${encodeURIComponent('Server error: ' + getErrorMessage(error))}`);
  }
});

// API status endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'AWS Knowledge Hub API is running!',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// MCP routes
app.use('/api/mcp', mcpRoutes);

// Question processing routes
app.use('/api/questions', questionRoutes);

// Documentation search routes
app.use('/api/search', documentationSearchRoutes);

// Answer generation routes
app.use('/api/answers', answerGenerationRoutes);

// Session management routes
import sessionRoutes from './routes/sessions';
app.use('/api/sessions', sessionRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, async () => {
  // Initialize database first
  await initializeDatabase();
  
  logger.info(`🚀 AWS Knowledge Hub server running on port ${PORT}`);
  logger.info(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`💾 Database: ${process.env.DATABASE_PATH || './data/knowledge-hub.db'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    databaseManager.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    databaseManager.close();
    process.exit(0);
  });
});

export { app, io };