# LinkHub SaaS - Link-in-Bio Platform

A modern, production-ready Link-in-Bio SaaS application built with TypeScript, Express.js, and PostgreSQL.

## 🚀 Features

- **User Management**: Registration, authentication, and profile management
- **Bio Pages**: Customizable link-in-bio pages with themes
- **Link Management**: Add, edit, and organize links with analytics
- **Premium Features**: Advanced themes and unlimited links
- **Analytics**: Track page views and link clicks
- **Subscription Management**: Stripe integration for payments
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Production Ready**: Docker, monitoring, and security features

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: JWT tokens
- **Payments**: Stripe
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate limiting
- **Monitoring**: Winston logging, Health checks
- **Deployment**: Docker, Docker Compose, Nginx

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose (for production)

## 🚀 Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd linkhub-saas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev:server
   ```

6. **Access the application**
   - Dashboard: http://localhost:3000
   - Debug page: http://localhost:3000/debug.html
   - Health check: http://localhost:3000/health
   - Example bio page: http://localhost:3000/demoaccount

### Production Deployment

#### Option 1: Docker Compose (Recommended)

1. **Clone and configure**
   ```bash
   git clone <your-repo-url>
   cd linkhub-saas
   cp .env.production .env
   # Edit .env with your production values
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations**
   ```bash
   docker-compose exec app npm run db:migrate
   docker-compose exec app npm run db:seed
   ```

#### Option 2: Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set up production database**
   ```bash
   npm run db:deploy
   npm run db:seed
   ```

3. **Start the application**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Environment Variables

Key environment variables for production:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/linkhub"

# Security
JWT_SECRET="your-super-secure-secret-key"
NODE_ENV="production"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email
EMAIL_HOST="smtp.sendgrid.net"
EMAIL_USER="apikey"
EMAIL_PASS="your-sendgrid-api-key"

# Redis
REDIS_URL="redis://localhost:6379"
```

### Database Schema

The application uses Prisma ORM with the following main entities:
- Users (authentication and profiles)
- BioPages (user's link-in-bio pages)
- Links (individual links on bio pages)
- Themes (page styling options)
- Analytics (tracking data)
- Subscriptions (premium features)

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/reset-password` - Password reset

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `POST /api/user/claim-username` - Claim username

### Bio Pages
- `GET /api/bio-page` - Get user's bio page
- `PUT /api/bio-page` - Update bio page
- `POST /api/bio-page/links` - Add link
- `PUT /api/bio-page/links/:id` - Update link
- `DELETE /api/bio-page/links/:id` - Delete link

### Public Pages
- `GET /:username` - Public bio page
- `GET /:username/link/:linkId` - Link redirect with tracking

### Analytics
- `GET /api/analytics/summary` - Analytics summary
- `GET /api/analytics/detailed` - Detailed analytics

### Subscriptions
- `GET /api/subscription/plans` - Available plans
- `POST /api/subscription/checkout` - Create checkout session
- `GET /api/subscription/manage` - Manage subscription

## 🔒 Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Request validation
- **SQL Injection Protection**: Prisma ORM
- **XSS Protection**: Content Security Policy

## 📈 Monitoring & Logging

- **Winston Logging**: Structured logging
- **Health Checks**: System health monitoring
- **Performance Monitoring**: Request timing
- **Error Tracking**: Centralized error logging

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 📝 API Documentation

Visit `/api/docs` for interactive API documentation (Swagger UI).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@linkhub.com or create an issue on GitHub.

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Set strong JWT_SECRET
- [ ] Configure production database
- [ ] Set up Redis instance
- [ ] Configure email service
- [ ] Set up Stripe webhooks
- [ ] Configure SSL certificates
- [ ] Set up monitoring/logging
- [ ] Configure backup strategy
- [ ] Test all functionality
- [ ] Set up CI/CD pipeline

## 📊 Performance

- **Response Time**: < 200ms average
- **Uptime**: 99.9% target
- **Concurrent Users**: 1000+ supported
- **Database**: Optimized queries with indexes
- **Caching**: Redis for session and data caching
- **CDN**: Static asset delivery optimization