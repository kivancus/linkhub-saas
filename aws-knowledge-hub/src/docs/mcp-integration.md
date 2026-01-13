# MCP Integration Documentation

## Overview

The AWS Knowledge Hub integrates with the AWS Documentation MCP (Model Context Protocol) server to provide intelligent access to AWS documentation. This integration enables the application to search, retrieve, and analyze AWS documentation in real-time.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  MCP Service    │    │ AWS Docs MCP    │
│                 │◄──►│                 │◄──►│     Server      │
│   Questions     │    │  Intelligence   │    │  (via Power)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   MCP Client    │
                       │   (Caching)     │
                       └─────────────────┘
```

## Components

### 1. MCP Client (`mcpClient.ts`)

Low-level client that handles direct communication with the MCP server.

**Features:**
- Connection management and retry logic
- Response caching with TTL
- Rate limiting and request queuing
- Error handling and recovery

**Key Methods:**
- `searchDocumentation()` - Search across AWS documentation
- `readDocumentation()` - Read specific documentation pages
- `getRecommendations()` - Get related documentation
- `getRegionalAvailability()` - Check service availability by region
- `listRegions()` - Get AWS regions list

### 2. MCP Service (`mcpService.ts`)

High-level service that provides intelligent search strategies and question analysis.

**Features:**
- Question analysis and classification
- AWS service extraction from natural language
- Intelligent search topic selection
- Result ranking and deduplication

**Key Methods:**
- `analyzeQuestion()` - Analyze user questions
- `intelligentSearch()` - Perform smart searches
- `getDocumentationContent()` - Get cached content
- `checkServiceAvailability()` - Regional availability checks

### 3. MCP Routes (`routes/mcp.ts`)

REST API endpoints for MCP functionality.

**Endpoints:**
- `GET /api/mcp/test` - Test MCP connectivity
- `POST /api/mcp/search` - Search documentation
- `POST /api/mcp/analyze` - Analyze questions
- `POST /api/mcp/read` - Read documentation
- `POST /api/mcp/recommendations` - Get recommendations
- `POST /api/mcp/availability` - Check availability
- `GET /api/mcp/regions` - List regions
- `GET /api/mcp/stats` - Get statistics

## Question Analysis

The system analyzes user questions to determine the best search strategy:

### Question Types
1. **Technical** - API, CLI, SDK related questions
2. **Conceptual** - "What is", explanations, differences
3. **Troubleshooting** - Errors, problems, issues
4. **How-to** - Step-by-step instructions

### AWS Service Extraction
Automatically identifies AWS services mentioned in questions:
- EC2, S3, Lambda, RDS, DynamoDB
- VPC, IAM, CloudFormation, CDK
- And 20+ other services

### Complexity Assessment
- **Simple** - Single service, short question
- **Moderate** - Multiple services or technical terms
- **Complex** - Multiple services, long questions, technical complexity

## Search Strategy

Based on question analysis, the system selects appropriate MCP search topics:

### MCP Search Topics
1. **reference_documentation** - API methods, SDK code, CLI commands
2. **current_awareness** - New features, announcements, releases
3. **troubleshooting** - Error messages, debugging, problems
4. **amplify_docs** - Frontend/mobile apps with Amplify framework
5. **cdk_docs** - CDK concepts, API references, CLI commands
6. **cdk_constructs** - CDK code examples, patterns, L3 constructs
7. **cloudformation** - CloudFormation templates, concepts, SAM patterns
8. **general** - Architecture, best practices, tutorials, blog posts

### Search Flow
1. **Primary Search** - Use suggested topics based on analysis
2. **Fallback Search** - If insufficient results, try additional topics
3. **Result Processing** - Deduplicate, sort by relevance
4. **Caching** - Cache results for performance

## Caching Strategy

### Cache Levels
1. **MCP Client Cache** - Raw MCP responses (5-15 minutes TTL)
2. **Database Cache** - Processed documentation content (longer TTL)
3. **Application Cache** - Frequently accessed data

### Cache Keys
- Search: `search:{question}:{options}`
- Read: `read:{url}:{options}`
- Recommendations: `recommendations:{url}`
- Regions: `regions_list` (1 hour TTL)

## Error Handling

### Retry Logic
- 3 retry attempts with exponential backoff
- Different timeouts based on question complexity
- Graceful degradation when MCP server unavailable

### Error Types
- `CONNECTION_FAILED` - Cannot connect to MCP server
- `SEARCH_FAILED` - Search operation failed
- `READ_FAILED` - Documentation read failed
- `TIMEOUT` - Request exceeded timeout

### Fallback Mechanisms
1. Return cached results if available
2. Suggest manual documentation links
3. Provide alternative search terms
4. Queue requests for retry

## Performance Optimization

### Request Management
- Maximum 5 concurrent requests to MCP server
- Request queuing for rate limiting
- Connection pooling and reuse

### Response Optimization
- Intelligent result ranking
- Duplicate removal
- Content truncation for large responses
- Progressive loading for complex queries

### Monitoring
- Response time tracking
- Cache hit/miss rates
- Error rate monitoring
- Usage analytics

## Usage Examples

### Basic Search
```typescript
const result = await mcpService.intelligentSearch(
  "How do I create an S3 bucket?",
  { limit: 5 }
);
```

### Question Analysis
```typescript
const analysis = mcpService.analyzeQuestion(
  "Lambda function timeout error with DynamoDB"
);
// Returns: { questionType: 'troubleshooting', awsServices: ['Lambda', 'DynamoDB'], ... }
```

### Documentation Reading
```typescript
const content = await mcpService.getDocumentationContent(
  "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html",
  5000 // max length
);
```

### Regional Availability
```typescript
const availability = await mcpService.checkServiceAvailability(
  ['Lambda', 'S3', 'DynamoDB'],
  'us-east-1'
);
```

## Configuration

### Environment Variables
```bash
MCP_SERVER_URL=http://localhost:8080
MCP_SERVER_TIMEOUT=30000
CACHE_TTL=300000
ENABLE_CACHE=true
```

### Client Configuration
```typescript
const mcpClient = new MCPClient({
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  maxConcurrentRequests: 5
});
```

## Testing

### Connection Test
```bash
curl http://localhost:5000/api/mcp/test
```

### Search Test
```bash
curl -X POST http://localhost:5000/api/mcp/search \
  -H "Content-Type: application/json" \
  -d '{"question": "How to deploy Lambda functions?"}'
```

### Analysis Test
```bash
curl -X POST http://localhost:5000/api/mcp/analyze \
  -H "Content-Type: application/json" \
  -d '{"question": "S3 bucket policy troubleshooting"}'
```

## Monitoring and Debugging

### Statistics Endpoint
```bash
curl http://localhost:5000/api/mcp/stats
```

Returns cache statistics, response times, and usage metrics.

### Logging
All MCP operations are logged with structured data:
- Request details (question, options)
- Response metrics (time, result count)
- Error information (type, message, stack)
- Cache performance (hits, misses)

### Health Checks
The MCP integration is included in the main health check endpoint:
```bash
curl http://localhost:5000/health
```

## Future Enhancements

1. **Real MCP Integration** - Replace mock implementation with actual MCP server
2. **Advanced Caching** - Redis integration for distributed caching
3. **Machine Learning** - Improve question analysis with ML models
4. **Personalization** - User-specific search preferences
5. **Analytics** - Advanced usage analytics and insights