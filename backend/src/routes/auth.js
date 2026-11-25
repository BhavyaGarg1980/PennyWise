import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';

const router = Router();
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

const COOKIE_NAME = 'token';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function createToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    currency: user.currency,
  };
}

// REGISTER
router.post('/register', async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      currency = 'INR',
    } = req.body;

    if (
      !name?.trim() ||
      !email?.trim() ||
      !password ||
      password.length < 8
    ) {
      return res.status(400).json({
        message:
          'Name, email, and password (at least 8 characters) are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email already registered.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      currency,
    });

    const token = createToken(user);

    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// LOGIN
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '')
      .toLowerCase()
      .trim();

    const password = req.body.password || '';

    const user = await User.findOne({ email });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    const token = createToken(user);

    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.json({
      message: 'Login successful.',
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// CURRENT USER
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    return res.json({
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res.json({
    message: 'Logged out successfully.',
  });
});

// CHANGE PASSWORD
router.post('/change-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: 'Please fill in all password fields.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'New passwords do not match.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: 'New password must be at least 8 characters long.',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: 'Your new password must differ from your current password.',
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found.',
      });
    }

    // Verify the current password
    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: 'Your current password is incorrect.',
      });
    }

    // Hash and save the new password
    user.passwordHash = await bcrypt.hash(newPassword, 12);

    await user.save();

    return res.status(200).json({
      message: 'Password changed successfully!',
    });
  } catch (error) {
    next(error);
  }
});

// GOOGLE LOGIN
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: 'Google credential is required.',
      });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({
        message: 'Invalid Google account information.',
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        message: 'Please use a verified Google email address.',
      });
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const name = payload.name?.trim() || email.split('@')[0];

    // Find an existing Google account
    let user = await User.findOne({ googleId });

    if (user) {
      // Google account already exists
    } else {
      // Check whether this email already belongs to an account
      user = await User.findOne({ email });

      if (user) {
        // Do not link a different Google account to an existing account
        // if it is already linked to another Google identity.
        if (user.googleId && user.googleId !== googleId) {
          return res.status(409).json({
            message:
              'This email is already linked to another Google account.',
          });
        }

        // Link the verified Google identity to the existing account
        user.googleId = googleId;
        await user.save();
      } else {
        // Create a new Google user
        user = await User.create({
          name: name.substring(0, 80),
          email,
          googleId,
          currency: 'INR',
        });
      }
    }

    // Create the same JWT used by existing login
    const token = createToken(user);

    // Set the existing HTTP-only authentication cookie
    res.cookie(COOKIE_NAME, token, cookieOptions);

    return res.status(200).json({
      message: 'Google login successful.',
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
