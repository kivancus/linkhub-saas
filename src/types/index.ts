import { Request } from 'express';

// Extend Express Request type to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string | null;
    subscriptionTier: 'free' | 'premium';
  };
}

// User types
export interface User {
  id: string;
  email: string;
  username: string | null;
  profileName: string | null;
  profileBio: string | null;
  profileImageUrl: string | null;
  subscriptionTier: 'free' | 'premium';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRegistration {
  email: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

// Bio Page types
export interface BioPage {
  id: string;
  userId: string;
  username: string;
  profileName: string;
  profileBio: string;
  profileImageUrl: string | null;
  themeId: string;
  customColors: ThemeColors | null;
  links: LinkItem[];
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  iconName: string | null;
  isActive: boolean;
  order: number;
}

export interface BioPageUpdate {
  profileName?: string;
  profileBio?: string;
  profileImageUrl?: string;
  themeId?: string;
  customColors?: ThemeColors | null;
  isPublished?: boolean;
}

// Theme types
export interface Theme {
  id: string;
  name: string;
  isPremium: boolean;
  previewImageUrl: string;
  cssTemplate: string;
  colorVariables: string[];
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
}

// Analytics types
export interface VisitorInfo {
  ipHash: string;
  userAgent: string;
  referrer: string | null;
  timestamp: Date;
}

export interface PageStats {
  totalViews: number;
  uniqueVisitors: number;
  dailyViews: DailyStats[];
  topReferrers: ReferrerStats[];
}

export interface DailyStats {
  date: string;
  views: number;
  uniqueVisitors: number;
}

export interface ReferrerStats {
  referrer: string;
  count: number;
}

export interface LinkStats {
  linkId: string;
  title: string;
  url: string;
  clicks: number;
  uniqueClicks: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// Subscription types
export interface SubscriptionStatus {
  isActive: boolean;
  tier: 'free' | 'premium';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface AppError extends Error {
  status?: number;
  code?: string;
  field?: string;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}