
import mongoose from 'mongoose';

const projectActivitySchema = new mongoose.Schema(
  {
    // Project associated with this activity.
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },

    // Task associated with the activity, if applicable.
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },

    // User who performed the action.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Preserve the actor's name at the time of the event.
    actorNameSnapshot: {
      type: String,
      required: true
    },

    // Preserve the project name at the time of the event.
    projectNameSnapshot: {
      type: String,
      required: true
    },

    // Preserve the task title at the time of the event.
    taskTitleSnapshot: {
      type: String,
      default: null
    },

    // Type of activity.
    action: {
      type: String,
      required: true,
      enum: [
        'TASK_CREATED',
        'TASK_UPDATED',
        'TASK_ASSIGNED',
        'TASK_UNASSIGNED',
        'TASK_REASSIGNED',
        'TASK_COMPLETED',
        'TASK_REOPENED',
        'TASK_DELETED',
        'TASK_STATUS_CHANGED',

        'PROJECT_CREATED',
        'PROJECT_UPDATED',
        'PROJECT_DELETED',

        'MEMBER_ADDED',
        'MEMBER_REMOVED',
        'MEMBER_ROLE_CHANGED'
      ]
    },

    // Other users involved in the activity.
    // For example, the user assigned to a task.
    relatedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],

    // Server-generated record of changed fields.
    changes: [
      {
        field: {
          type: String,
          required: true
        },

        from: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        },

        to: {
          type: mongoose.Schema.Types.Mixed,
          default: null
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Optimize project timeline queries.
projectActivitySchema.index({
  projectId: 1,
  createdAt: -1
});

// Optimize activity queries by actor.
projectActivitySchema.index({
  actor: 1,
  createdAt: -1
});

// Optimize queries involving other participating users.
projectActivitySchema.index({
  relatedUserIds: 1,
  createdAt: -1
});

export const ProjectActivity = mongoose.model(
  'ProjectActivity',
  projectActivitySchema
);
