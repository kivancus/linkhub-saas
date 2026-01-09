# Contributing to LinkHub SaaS

## 🤝 Welcome Contributors!

Thank you for your interest in contributing to LinkHub SaaS! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites
- Node.js 18+
- Git
- Basic knowledge of TypeScript, Express.js, and React

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/linkhub-saas.git
   cd linkhub-saas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with development values
   ```

4. **Set up database**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev:server
   ```

## Making Changes

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages
Follow conventional commit format:
```
type(scope): description

feat(auth): add password reset functionality
fix(bio-page): resolve theme loading issue
docs(readme): update installation instructions
```

### Code Style
- Use TypeScript for all new code
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic
- Follow REST API conventions

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- auth.test.ts
```

### Writing Tests
- Write unit tests for new functions
- Write integration tests for API endpoints
- Use property-based testing for complex logic
- Aim for good test coverage

### Test Structure
```typescript
describe('User Authentication', () => {
  it('should register a new user', async () => {
    // Test implementation
  });
  
  it('should reject invalid passwords', async () => {
    // Test implementation
  });
});
```

## Submitting Changes

### Pull Request Process

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

3. **Test your changes**
   ```bash
   npm test
   npm run build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Go to GitHub and create a PR
   - Fill out the PR template
   - Link any related issues

### Pull Request Guidelines

- **Title**: Clear, descriptive title
- **Description**: Explain what changes were made and why
- **Testing**: Describe how the changes were tested
- **Screenshots**: Include screenshots for UI changes
- **Breaking Changes**: Clearly mark any breaking changes

### Review Process

1. Automated checks must pass
2. Code review by maintainers
3. Address feedback if requested
4. Merge after approval

## Development Guidelines

### File Structure
```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── services/        # Business logic
├── utils/           # Utility functions
├── types/           # TypeScript types
└── test/            # Test utilities
```

### API Design
- Use RESTful conventions
- Return consistent response format
- Include proper error handling
- Add input validation
- Document with JSDoc comments

### Database Changes
- Create migrations for schema changes
- Update seed data if needed
- Test migrations thoroughly
- Document breaking changes

### Security Considerations
- Validate all inputs
- Use parameterized queries
- Implement proper authentication
- Follow OWASP guidelines
- Never commit secrets

## Getting Help

### Resources
- [Project Documentation](README.md)
- [Deployment Guide](DEPLOYMENT.md)
- [API Documentation](docs/api.md)

### Communication
- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: General questions and ideas
- Email: For security issues

### Common Issues

**Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

**Database Issues**
```bash
# Reset database
npm run db:reset
npm run db:seed
```

**Test Failures**
```bash
# Run tests with verbose output
npm test -- --verbose
```

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- GitHub contributor graphs

Thank you for contributing to LinkHub SaaS! 🚀