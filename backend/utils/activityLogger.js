
import { ProjectActivity } from '../models/projectActivity.js';

/**
 * Records an activity associated with a project.
 *
 * The actor must come from the authenticated request.
 * The project and task should come from the database.
 */
export async function recordProjectActivity({
  project,
  actor,
  action,
  task = null,
  taskTitleSnapshot = null,
  relatedUserIds = [],
  changes = [],
  session = null
}) {
  // Ensure the required database information exists.
  if (!project?._id || !actor?._id || !action) {
    throw new Error(
      'Project, authenticated actor, and action are required.'
    );
  }

  // Remove duplicate user IDs.
  const uniqueRelatedUserIds = [
    ...new Set(
      relatedUserIds
        .filter(Boolean)
        .map((id) => id.toString())
    )
  ];

  const activity = new ProjectActivity({
    projectId: project._id,

    taskId: task?._id || null,

    actor: actor._id,
    actorNameSnapshot: actor.name || 'User',

    projectNameSnapshot: project.name || 'Project',

    taskTitleSnapshot:
      taskTitleSnapshot ?? task?.title ?? null,

    action,

    relatedUserIds: uniqueRelatedUserIds,

    changes
  });

  // Support MongoDB transactions when a session is provided.
  if (session) {
    await activity.save({ session });
  } else {
    await activity.save();
  }

  return activity;
}
