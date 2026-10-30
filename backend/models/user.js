
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 80
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },

    profileImage: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model('User', userSchema);
