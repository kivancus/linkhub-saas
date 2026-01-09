# LinkHub SaaS - Deployment Guide

## 🚀 Quick Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL 13+ (for production)
- Redis 6+ (optional, for caching)
- Stripe account (for payments)

### Development Setup

1. **Clone and Install**
   ```bash
   git clone <your-repo-url>
   cd linkhub-saas
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start Development Server**
   ```bash
   npm run dev:server
   ```

5. **Access Application**
   - Dashboard: http://localhost:3000
   - Demo Bio Page: http://localhost:3000/demoaccount
   - Health Check: http://localhost:3000/health

### Production Deployment

#### Option 1: Docker Compose (Recommended)

```bash
# 1. Configure environment
cp .env.production .env
# Edit .env with production values

# 2. Deploy
docker-compose up -d

# 3. Setup database
docker-compose exec app npm run db:migrate
docker-compose exec app npm run db:seed
```

#### Option 2: Manual Deployment

```bash
# 1. Build application
npm run build

# 2. Setup production database
npm run db:deploy
npm run db:seed

# 3. Start application
npm start
```

### Environment Variables

#### Required for Production
```bash
DATABASE_URL="postgresql://user:pass@host:5432/linkhub"
JWT_SECRET="your-super-secure-secret-key"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

#### Optional Services
```bash
REDIS_URL="redis://localhost:6379"
EMAIL_HOST="smtp.sendgrid.net"
EMAIL_USER="apikey"
EMAIL_PASS="your-sendgrid-api-key"
```

## 🔧 Configuration

### Database Migration
```bash
# Development
npm run db:migrate

# Production
npm run db:deploy
```

### Stripe Webhooks
1. Create webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
2. Add webhook secret to `STRIPE_WEBHOOK_SECRET`
3. Subscribe to events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

### SSL Setup
1. Obtain SSL certificates
2. Update `nginx.conf` with certificate paths
3. Uncomment HTTPS server block

## 📊 Monitoring

### Health Checks
- Endpoint: `/health`
- Checks: Database, Redis, Memory usage
- Status codes: 200 (healthy), 503 (unhealthy)

### Logs
- Location: `logs/` directory
- Levels: error, warn, info, debug
- Format: JSON structured logs

## 🔒 Security

### Production Checklist
- [ ] Strong JWT_SECRET (32+ characters)
- [ ] HTTPS enabled
- [ ] Database credentials secured
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled (Helmet.js)

## 🚀 Scaling

### Performance Optimization
- Enable Redis caching
- Use CDN for static assets
- Database connection pooling
- Horizontal scaling with load balancer

### Monitoring & Alerts
- Set up application monitoring (Sentry, DataDog)
- Database performance monitoring
- Server resource monitoring
- Uptime monitoring

## 🆘 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check database URL
echo $DATABASE_URL

# Test connection
npm run db:studio
```

**Redis Connection Failed**
```bash
# Redis is optional for development
export REDIS_ENABLED=false

# Or install Redis
brew install redis  # macOS
sudo apt install redis-server  # Ubuntu
```

**Build Errors**
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Support
- GitHub Issues: Create an issue for bugs
- Documentation: Check README.md
- Logs: Check `logs/` directory for errors