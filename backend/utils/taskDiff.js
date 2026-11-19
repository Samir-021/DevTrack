import { recordProjectActivity } from './activityLogger.js';
import { User } from '../models/user.js';

/**
 * Calculates field-level diffs and logs corresponding activity events
 * when a task is updated.
 */
export async function logTaskUpdateActivities({
  project,
  actor,
  existingTask,
  updates
}) {
  const changes = [];
  const relatedUserIds = [];

  // 1. Title change
  if (updates.title !== undefined && updates.title.trim() !== existingTask.title) {
    changes.push({
      field: 'title',
      from: existingTask.title,
      to: updates.title.trim()
    });
  }

  // 2. Priority change
  if (updates.priority !== undefined && updates.priority !== existingTask.priority) {
    changes.push({
      field: 'priority',
      from: existingTask.priority,
      to: updates.priority
    });
  }

  // 3. Due Date change
  const oldDueDate = existingTask.dueDate ? new Date(existingTask.dueDate).toISOString().split('T')[0] : null;
  const newDueDate = updates.dueDate ? new Date(updates.dueDate).toISOString().split('T')[0] : null;
  if (updates.dueDate !== undefined && oldDueDate !== newDueDate) {
    changes.push({
      field: 'dueDate',
      from: oldDueDate,
      to: newDueDate
    });
  }

  // 4. Status change
  let statusAction = null;
  if (updates.status !== undefined && updates.status !== existingTask.status) {
    changes.push({
      field: 'status',
      from: existingTask.status,
      to: updates.status
    });

    if (updates.status === 'Completed') {
      statusAction = 'TASK_COMPLETED';
    } else if (existingTask.status === 'Completed' && updates.status !== 'Completed') {
      statusAction = 'TASK_REOPENED';
    } else {
      statusAction = 'TASK_STATUS_CHANGED';
    }
  }

  // 5. Assignment change
  let assignmentAction = null;
  const oldAssigneeId = existingTask.assignedTo ? existingTask.assignedTo.toString() : null;
  const newAssigneeId = updates.assignedTo ? updates.assignedTo.toString() : null;

  if (updates.assignedTo !== undefined && oldAssigneeId !== newAssigneeId) {
    let oldAssigneeName = null;
    let newAssigneeName = null;

    const idsToLookup = [oldAssigneeId, newAssigneeId].filter(Boolean);
    if (idsToLookup.length > 0) {
      const users = await User.find({ _id: { $in: idsToLookup } }).select('_id name');
      const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));
      oldAssigneeName = oldAssigneeId ? userMap.get(oldAssigneeId) || oldAssigneeId : null;
      newAssigneeName = newAssigneeId ? userMap.get(newAssigneeId) || newAssigneeId : null;
    }

    changes.push({
      field: 'assignedTo',
      from: oldAssigneeName,
      to: newAssigneeName
    });

    if (!oldAssigneeId && newAssigneeId) {
      assignmentAction = 'TASK_ASSIGNED';
      relatedUserIds.push(newAssigneeId);
    } else if (oldAssigneeId && !newAssigneeId) {
      assignmentAction = 'TASK_UNASSIGNED';
      relatedUserIds.push(oldAssigneeId);
    } else if (oldAssigneeId && newAssigneeId) {
      assignmentAction = 'TASK_REASSIGNED';
      relatedUserIds.push(oldAssigneeId, newAssigneeId);
    }
  } else if (newAssigneeId) {
    relatedUserIds.push(newAssigneeId);
  }

  // 6. Dependencies change
  if (updates.dependencies && Array.isArray(updates.dependencies)) {
    const oldDeps = (existingTask.dependencies || []).map(d => (d._id || d).toString()).sort().join(',');
    const newDeps = updates.dependencies.map(d => d.toString()).sort().join(',');
    if (oldDeps !== newDeps) {
      changes.push({
        field: 'dependencies',
        from: (existingTask.dependencies || []).map(d => (d._id || d).toString()),
        to: updates.dependencies.map(d => d.toString())
      });
    }
  }

  // If no fields changed, nothing to log.
  if (changes.length === 0) {
    return [];
  }

  const activities = [];

  try {
    // If status changed, record status event with all current changes
    if (statusAction) {
      const activity = await recordProjectActivity({
        project,
        actor,
        action: statusAction,
        task: existingTask,
        relatedUserIds,
        changes
      });
      activities.push(activity);
    }

    // If assignment changed separately, record assignment event
    if (assignmentAction) {
      const activity = await recordProjectActivity({
        project,
        actor,
        action: assignmentAction,
        task: existingTask,
        relatedUserIds,
        changes: changes.filter(c => c.field === 'assignedTo')
      });
      activities.push(activity);
    }

    // If neither status nor assignment changed, but other fields did, record TASK_UPDATED
    if (!statusAction && !assignmentAction) {
      const activity = await recordProjectActivity({
        project,
        actor,
        action: 'TASK_UPDATED',
        task: existingTask,
        relatedUserIds,
        changes
      });
      activities.push(activity);
    }
  } catch (error) {
    console.error('Failed to record task update activity:', error);
  }

  return activities;
}
