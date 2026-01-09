import express from 'express';
import { UserService } from '../services/userService';
import { ValidationError, ConflictError, AuthenticationError } from '../utils/errors';

const router = express.Router();
const userService = new UserService();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
      return;
    }

    const result = await userService.register({ email, password });

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        message: 'Registration successful! Please check your email to verify your account.'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error instanceof ValidationError || error instanceof ConflictError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Registration failed'
      }
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
      return;
    }

    const result = await userService.login({ email, password });

    res.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        message: 'Login successful!'
      }
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error instanceof ValidationError && error.field && { field: error.field })
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Login failed'
      }
    });
  }
});

// Request password reset
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          field: 'email'
        }
      });
      return;
    }

    await userService.requestPasswordReset(email);

    // Always return success for security (don't reveal if email exists)
    res.json({
      success: true,
      data: {
        message: 'If an account with that email exists, a password reset link has been sent.'
      }
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Password reset request failed'
      }
    });
  }
});

// Confirm password reset
router.post('/reset-password/confirm', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Token and new password are required'
        }
      });
      return;
    }

    await userService.resetPassword(token, password);

    res.json({
      success: true,
      data: {
        message: 'Password reset successful! You can now login with your new password.'
      }
    });
  } catch (error) {
    console.error('Password reset confirm error:', error);

    if (error instanceof ValidationError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Password reset failed'
      }
    });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verification token is required',
          field: 'token'
        }
      });
      return;
    }

    await userService.verifyEmail(token);

    res.json({
      success: true,
      data: {
        message: 'Email verified successfully!'
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);

    if (error instanceof ValidationError) {
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          field: error.field
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Email verification failed'
      }
    });
  }
});

export default router;