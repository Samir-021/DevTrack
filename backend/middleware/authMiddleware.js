import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // Check whether the Authorization header exists.
    if (!authHeader) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }

    // Expected format:
    // Authorization: Bearer <token>
    const parts = authHeader.split(' ');

    if (
      parts.length !== 2 ||
      parts[0] !== 'Bearer' ||
      !parts[1]
    ) {
      return res.status(401).json({
        message: 'Invalid authorization format.'
      });
    }

    const token = parts[1];

    // Verify the token and extract its payload.
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Find the user associated with the token.
    const user = await User.findById(decoded.userId)
      .select('_id name email');

    if (!user) {
      return res.status(401).json({
        message: 'User no longer exists.'
      });
    }

    // Attach authenticated user to the request.
    req.user = user;

    next();

  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(401).json({
      message: 'Invalid or expired authentication token.'
    });
  }
}