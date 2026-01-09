import { AppError } from '../types';

export class ValidationError extends Error implements AppError {
  status = 400;
  code = 'VALIDATION_ERROR';
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    if (field !== undefined) {
      this.field = field;
    }
  }
}

export class AuthenticationError extends Error implements AppError {
  status = 401;
  code = 'AUTHENTICATION_ERROR';

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements AppError {
  status = 403;
  code = 'AUTHORIZATION_ERROR';

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements AppError {
  status = 404;
  code = 'NOT_FOUND_ERROR';

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements AppError {
  status = 409;
  code = 'CONFLICT_ERROR';
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ConflictError';
    if (field !== undefined) {
      this.field = field;
    }
  }
}

export class InternalServerError extends Error implements AppError {
  status = 500;
  code = 'INTERNAL_SERVER_ERROR';

  constructor(message: string = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

export class ExternalServiceError extends Error implements AppError {
  status = 502;
  code = 'EXTERNAL_SERVICE_ERROR';

  constructor(message: string = 'External service unavailable') {
    super(message);
    this.name = 'ExternalServiceError';
  }
}