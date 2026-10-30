
import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  status: {
    type: String,
    required: true
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  members: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      role: {
        type: String,
        enum: ['developer', 'viewer'],
        default: 'developer',
        required: true
      }
    }
  ]
}, {
  timestamps: true
});

export const Project = mongoose.model('Project', projectSchema);
