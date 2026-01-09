import { ValidationError } from './errors';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateUsername = (username: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 30) {
    errors.push('Username must be less than 30 characters long');
  }
  
  if (!/^[a-z0-9-]+$/.test(username)) {
    errors.push('Username must contain only lowercase letters, numbers, and hyphens');
  }
  
  if (username.startsWith('-') || username.endsWith('-')) {
    errors.push('Username cannot start or end with a hyphen');
  }
  
  if (username.includes('--')) {
    errors.push('Username cannot contain consecutive hyphens');
  }
  
  // Reserved usernames
  const reserved = [
    'api', 'www', 'admin', 'root', 'support', 'help', 'about', 'contact',
    'privacy', 'terms', 'blog', 'news', 'app', 'mail', 'ftp', 'cdn',
    'assets', 'static', 'uploads', 'download', 'login', 'register',
    'signup', 'signin', 'logout', 'dashboard', 'profile', 'settings',
    'account', 'billing', 'subscription', 'premium', 'pro', 'plus',
  ];
  
  if (reserved.includes(username.toLowerCase())) {
    errors.push('This username is reserved and cannot be used');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

export const validateHexColor = (color: string): boolean => {
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexColorRegex.test(color);
};

export const sanitizeString = (str: string, maxLength: number = 255): string => {
  return str.trim().substring(0, maxLength);
};

export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
};

export const validateStringLength = (
  value: string,
  fieldName: string,
  minLength: number = 0,
  maxLength: number = 255
): void => {
  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters long`,
      fieldName
    );
  }
  
  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be less than ${maxLength} characters long`,
      fieldName
    );
  }
};