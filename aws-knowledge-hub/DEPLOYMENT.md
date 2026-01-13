# AWS Knowledge Hub - Deployment Guide

## Quick Start (Test Environment)

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation Steps

1. **Navigate to the application directory:**
   ```bash
   cd aws-knowledge-hub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file if needed (defaults should work for testing):
   ```
   NODE_ENV=development
   PORT=5000
   DATABASE_PATH=./data/knowledge-hub.db
   FRONTEND_URL=http://localhost:5000
   ```

4. **Build the application:**
   ```bash
   npm run build
   ```

5. **Start the application:**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

6. **Access the application:**
   - **Main Chat Interface**: http://localhost:3001
   - **Demo & Testing Page**: http://localhost:3001/demo.html
   - **API Status**: http://localhost:3001/api
   - **Health Check**: http://localhost:3001/health

### Quick Test

Run the automated test script to verify everything is working:
```bash
./test-api.sh
```

This will test all major endpoints and confirm the application is running correctly.

### Web Interface Features

The application now includes a **professional web interface** with:

#### Main Chat Interface (/)
- 🎨 **Modern Design**: Beautiful gradient interface with AWS branding
- 💬 **Real-time Chat**: Instant Q&A with typing indicators and animations
- 📱 **Responsive**: Works perfectly on desktop, tablet, and mobile
- 🔗 **Session Management**: Automatic session creation and management
- 📊 **Processing Time**: Shows response time for each answer
- 🔗 **Source Links**: Direct links to AWS documentation sources
- ⚡ **Status Indicator**: Real-time connection status

#### Demo & Testing Page (/demo.html)
- 📊 **System Dashboard**: Live statistics and health monitoring
- 🧪 **API Testing**: Interactive testing of all endpoints
- 📈 **Performance Metrics**: Session and conversation statistics
- 🔧 **Developer Tools**: Complete API testing suite

### Testing the Application

#### Health Check
```bash
curl http://localhost:3001/health
```

#### Create a Session
```bash
curl -X POST http://localhost:3001/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"preferences": {"theme": "light"}}'
```

#### Ask a Question
```bash
curl -X POST http://localhost:3001/api/answers/complete \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do I create an S3 bucket?",
    "sessionId": "your-session-id-here"
  }'
```

#### Test Answer Generation
```bash
curl http://localhost:3001/api/answers/test
```

### Available Endpoints

#### Session Management
- `POST /api/sessions/create` - Create new session
- `GET /api/sessions/:sessionId` - Get session info
- `DELETE /api/sessions/:sessionId` - Delete session
- `GET /api/sessions/:sessionId/history` - Get conversation history
- `GET /api/sessions/:sessionId/search?q=term` - Search conversations
- `GET /api/sessions/admin/stats` - Get session statistics

#### Question Processing
- `POST /api/questions/process` - Process and analyze question
- `POST /api/questions/validate` - Validate question
- `GET /api/questions/suggestions` - Get question suggestions
- `GET /api/questions/test` - Test question processing

#### Documentation Search
- `POST /api/search/documentation` - Search AWS documentation
- `GET /api/search/suggestions?q=term` - Get search suggestions
- `GET /api/search/related?service=s3` - Get related documentation
- `GET /api/search/test` - Test search functionality

#### Answer Generation
- `POST /api/answers/generate` - Generate answer from search results
- `POST /api/answers/quick` - Generate quick answer
- `POST /api/answers/complete` - Complete Q&A pipeline
- `GET /api/answers/test` - Test answer generation
- `GET /api/answers/stats` - Get generation statistics

#### System
- `GET /health` - Health check
- `GET /api/stats` - Database statistics
- `GET /api` - API status

### Troubleshooting

#### Database Issues
If you encounter database errors:
```bash
# Remove existing database and restart
rm -f ./data/knowledge-hub.db
npm start
```

#### Port Already in Use
If port 3001 is busy, change the PORT in `.env`:
```
PORT=3000
```

#### MCP Server Connection Issues
The application includes mock responses for testing without MCP server connection. In production, you'll need to configure the actual AWS Documentation MCP server.

### Development Mode

For development with auto-reload:
```bash
npm run dev
```

This will:
- Start the server with nodemon
- Auto-reload on file changes
- Enable detailed logging
- Seed the database with test data

### Production Deployment

For production deployment:

1. Set environment to production:
   ```
   NODE_ENV=production
   ```

2. Configure proper database path:
   ```
   DATABASE_PATH=/var/lib/aws-knowledge-hub/knowledge-hub.db
   ```

3. Set up reverse proxy (nginx recommended)

4. Configure SSL/TLS certificates

5. Set up monitoring and logging

6. Configure backup procedures for the database

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │────│  Express.js API │────│   SQLite DB     │
│   (Chat UI)     │    │   (REST + WS)   │    │  (Sessions)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │   MCP Server    │
                       │ (AWS Docs API)  │
                       └─────────────────┘
```

### Features Available

✅ **Core Features:**
- Interactive chat interface
- Session management with conversation history
- Intelligent question processing and analysis
- AWS documentation search with caching
- Comprehensive answer generation
- Real-time Q&A pipeline
- Performance monitoring and statistics

✅ **Technical Features:**
- TypeScript for type safety
- SQLite database with automatic setup
- Comprehensive error handling
- Request rate limiting
- Security middleware
- Structured logging
- Health checks and monitoring
- Graceful shutdown handling

### Next Steps for Production

1. **MCP Server Integration**: Configure actual AWS Documentation MCP server
2. **Authentication**: Add user authentication and authorization
3. **Monitoring**: Set up comprehensive monitoring and alerting
4. **Scaling**: Configure load balancing and horizontal scaling
5. **Backup**: Implement automated database backup procedures
6. **Security**: Add additional security measures for production use

The application is now ready for testing and development!