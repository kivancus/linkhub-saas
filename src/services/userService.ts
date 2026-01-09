import prisma from '../config/database';
import { hashPassword, comparePassword, generateJWT, generateSecureToken } from '../utils/crypto';
import { validateEmail, validatePassword, validateUsername } from '../utils/validation';
import { ValidationError, ConflictError, AuthenticationError } from '../utils/errors';
import { User, AuthResult, UserRegistration, UserLogin } from '../types';

export class UserService {
  async register(data: UserRegistration): Promise<AuthResult> {
    const { email, password } = data;

    // Validate input
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new ValidationError(passwordValidation.errors[0] || 'Invalid password', 'password');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new ConflictError('Email already registered', 'email');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate email verification token
    const emailVerificationToken = generateSecureToken();

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        emailVerificationToken,
        subscriptionTier: 'free'
      },
      select: {
        id: true,
        email: true,
        username: true,
        profileName: true,
        profileBio: true,
        profileImageUrl: true,
        subscriptionTier: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Generate JWT token
    const token = generateJWT({
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier
    });

    // TODO: Send verification email in production
    console.log(`📧 Email verification token for ${email}: ${emailVerificationToken}`);

    return {
      user: user as User,
      token
    };
  }

  async login(data: UserLogin): Promise<AuthResult> {
    const { email, password } = data;

    // Validate input
    if (!validateEmail(email)) {
      throw new ValidationError('Invalid email format', 'email');
    }

    if (!password) {
      throw new ValidationError('Password is required', 'password');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate JWT token
    const token = generateJWT({
      userId: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier
    });

    // Return user data (excluding sensitive fields)
    const { passwordHash, emailVerificationToken, passwordResetToken, passwordResetExpires, ...userData } = user;

    return {
      user: userData as User,
      token
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        profileName: true,
        profileBio: true,
        profileImageUrl: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user as User | null;
  }

  async updateProfile(userId: string, updates: {
    profileName?: string;
    profileBio?: string;
    profileImageUrl?: string;
  }): Promise<User> {
    // Validate updates
    if (updates.profileName !== undefined && updates.profileName.length > 100) {
      throw new ValidationError('Profile name must be less than 100 characters', 'profileName');
    }

    if (updates.profileBio !== undefined && updates.profileBio.length > 500) {
      throw new ValidationError('Profile bio must be less than 500 characters', 'profileBio');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        username: true,
        profileName: true,
        profileBio: true,
        profileImageUrl: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user as User;
  }

  async claimUsername(userId: string, username: string): Promise<User> {
    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      throw new ValidationError(usernameValidation.errors[0] || 'Invalid username', 'username');
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictError('Username already taken', 'username');
    }

    // Update user with new username
    const user = await prisma.user.update({
      where: { id: userId },
      data: { username: username.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        profileName: true,
        profileBio: true,
        profileImageUrl: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return user as User;
  }

  async requestPasswordReset(email: string): Promise<void> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return;
    }

    // Generate reset token
    const resetToken = generateSecureToken();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

    // Save reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      }
    });

    // TODO: Send password reset email in production
    console.log(`🔑 Password reset token for ${email}: ${resetToken}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new ValidationError(passwordValidation.errors[0] || 'Invalid password', 'password');
    }

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new ValidationError('Invalid or expired reset token', 'token');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });
  }

  async verifyEmail(token: string): Promise<void> {
    // Find user with verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token
      }
    });

    if (!user) {
      throw new ValidationError('Invalid verification token', 'token');
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null
      }
    });
  }
}