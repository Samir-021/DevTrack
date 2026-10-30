
import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.js';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/authMiddleware.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024 // Maximum 5 MB
  },

  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed.'));
    }
  }
});

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'devtrack/profile-images',
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    stream.end(buffer);
  });
};

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate required fields.
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Name, email, and password are required.'
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Validate basic input constraints.
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      return res.status(400).json({
        message: 'Name must be between 2 and 80 characters.'
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: 'Password must be between 8 and 72 characters.'
      });
    }

    // 3. Check whether the email already exists.
    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.'
      });
    }

    // 4. Hash the password before storing it.
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Create the user.
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword
    });

    // 6. Return safe user information.
    return res.status(201).json({
      message: 'Registration successful.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    // Handle duplicate email even if simultaneous requests race.
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email already exists.'
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      message: 'Registration failed. Please try again.'
    });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Password is normally excluded because of select: false.
    // Explicitly request it for authentication.
    const user = await User.findOne({
      email: normalizedEmail
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    // Compare the supplied password with the stored bcrypt hash.
    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    // Authentication succeeded.
    const token = jwt.sign(
      {
        userId: user._id.toString()
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage || ''
      }
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Login failed. Please try again.'
    });
  }
});


/**
 * PUT /auth/profile
 * Update the authenticated user's name and email.
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, email } = req.body ?? {};

    // Validate required fields.
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      !name.trim() ||
      !email.trim()
    ) {
      return res.status(400).json({
        message: 'Name and email are required.'
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2 || normalizedName.length > 80) {
      return res.status(400).json({
        message: 'Name must be between 2 and 80 characters.'
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: 'Please provide a valid email address.'
      });
    }

    // Check whether another account uses this email.
    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.'
      });
    }

    // Update only the authenticated user's account.
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          name: normalizedName,
          email: normalizedEmail
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).select('_id name email createdAt updatedAt');

    if (!user) {
      return res.status(404).json({
        message: 'User account not found.'
      });
    }

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    // Handles a duplicate-email race between concurrent requests.
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email already exists.'
      });
    }

    console.error('Profile update error:', error);

    return res.status(500).json({
      message: 'Failed to update profile. Please try again.'
    });
  }
});

router.post(
  '/profile-image',
  authenticate,

  // Handle Multer errors and return JSON responses.
  (req, res, next) => {
    upload.single('image')(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'Image must be 5 MB or smaller.'
          });
        }

        return res.status(400).json({
          message: error.message
        });
      }

      if (error) {
        return res.status(400).json({
          message: error.message
        });
      }

      next();
    });
  },

  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: 'Please select an image to upload.'
        });
      }

      // Upload the image to Cloudinary.
      const result = await uploadToCloudinary(req.file.buffer);

      // Save the Cloudinary URL to the authenticated user's record.
      const user = await User.findByIdAndUpdate(
        req.user._id,
        {
          $set: {
            profileImage: result.secure_url
          }
        },
        {
          returnDocument: 'after',
          runValidators: true
        }
      ).select('_id name email profileImage createdAt updatedAt');

      if (!user) {
        return res.status(404).json({
          message: 'User not found.'
        });
      }

      return res.status(200).json({
        message: 'Profile picture uploaded successfully.',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      console.error('Profile image upload error:', error);

      return res.status(500).json({
        message: 'Failed to upload profile picture. Please try again.'
      });
    }
  }
);

export default router;
