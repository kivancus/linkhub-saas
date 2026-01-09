import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '7d';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateJWT = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyJWT = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};

export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

export const hashIP = (ip: string): string => {
  // Hash IP for privacy while maintaining uniqueness for analytics
  return crypto.createHash('sha256').update(ip + (process.env['JWT_SECRET'] || 'fallback')).digest('hex');
};

export const generateResetToken = (): { token: string; expires: Date } => {
  const token = generateSecureToken(32);
  const expires = new Date();
  expires.setHours(expires.getHours() + 1); // 1 hour expiry
  
  return { token, expires };
};