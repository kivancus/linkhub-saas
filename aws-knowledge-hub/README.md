# AWS Knowledge Hub

An intelligent Q&A application that provides accurate, real-time answers to AWS technical questions by leveraging the AWS Documentation MCP server.

## Features

- 🤖 **Intelligent Question Processing** - Natural language AWS questions with smart analysis
- 📚 **AWS Documentation Integration** - Real-time access to comprehensive AWS documentation via MCP server
- 🔍 **Multi-Topic Search** - Searches across reference docs, troubleshooting, CDK, CloudFormation, and more
- 💬 **Session Management** - Conversation history and context-aware follow-up questions
- ⚡ **Real-time Interface** - WebSocket-powered chat with typing indicators and progress updates
- 🎯 **Auto-Suggestions** - Smart completion for AWS services and common questions
- 🚀 **Production-Ready** - Docker deployment, monitoring, caching, and security hardening

## Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: SQLite with better-sqlite3
- **Real-time**: Socket.io
- **Documentation**: AWS Documentation MCP Server
- **Security**: Helmet, CORS, Rate limiting
- **Logging**: Winston
- **Development**: ESLint, Prettier, Nodemon

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- AWS Documentation MCP Server (configured separately)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aws-knowledge-hub
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build the project:
```bash
npm run build
```

5. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm test` - Run tests (to be implemented)
- `npm run clean` - Remove build directory

## API Endpoints

### Health Check
- `GET /health` - Server health status

### API Info
- `GET /api` - API information

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `DATABASE_PATH` | SQLite database path | `./data/knowledge-hub.db` |
| `MCP_SERVER_URL` | MCP server URL | `http://localhost:8080` |
| `SESSION_SECRET` | Session secret key | Required |
| `LOG_LEVEL` | Logging level | `info` |

## Project Structure

```
aws-knowledge-hub/
├── src/
│   ├── config/          # Configuration files
│   ├── database/        # Database setup and migrations
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── server.ts        # Main server file
├── dist/                # Compiled JavaScript (generated)
├── logs/                # Log files
├── data/                # Database files
└── frontend/            # React frontend (to be added)
```

## Development Status

✅ **Completed Tasks:**
- [x] Project initialization and TypeScript setup
- [x] Express.js server with middleware
- [x] Logging with Winston
- [x] Error handling middleware
- [x] Environment configuration
- [x] ESLint and Prettier setup
- [x] Basic API endpoints
- [x] WebSocket integration setup

🚧 **In Progress:**
- [ ] Database setup and schema
- [ ] MCP server integration
- [ ] Question processing engine
- [ ] Documentation search service
- [ ] Answer generation service

📋 **Planned:**
- [ ] Session management
- [ ] REST API endpoints
- [ ] React frontend
- [ ] Testing suite
- [ ] Docker deployment
- [ ] Production hardening

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Commit your changes: `git commit -am 'Add feature'`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions and support, please open an issue in the GitHub repository.