import express from 'express';
import { Project } from '../models/project.js';
import { Task } from '../models/task.js';
import { ProjectActivity } from '../models/projectActivity.js';
import { User } from '../models/user.js';

const router = express.Router();

/**
 * Helper to get all project IDs accessible to the authenticated user.
 */
async function getAccessibleProjectIds(userId) {
  const projects = await Project.find({
    $or: [
      { owner: userId },
      { 'members.user': userId }
    ]
  }).select('_id');

  return projects.map((p) => p._id);
}

/**
 * GET /contributions
 * Fetches all accessible projects with team member contribution metrics and activity counts.
 */
router.get('/', async (req, res) => {
  try {
    const accessibleProjects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    })
      .populate('owner', '_id name email profileImage')
      .populate('members.user', '_id name email profileImage')
      .sort({ createdAt: -1 });

    const projectContributions = await Promise.all(
      accessibleProjects.map(async (project) => {
        // Fetch all active tasks for this project
        const tasks = await Task.find({ projectId: project._id })
          .populate('assignedTo', '_id name email profileImage');

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
        const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
        const pendingTasks = tasks.filter((t) => t.status === 'Pending').length;

        const overallCompletionPercentage =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Determine user's role in this project
        let currentUserRole = 'viewer';
        if (project.owner._id.toString() === req.user._id.toString()) {
          currentUserRole = 'owner';
        } else {
          const membership = project.members.find(
            (m) => m.user && m.user._id.toString() === req.user._id.toString()
          );
          if (membership) {
            currentUserRole = membership.role;
          }
        }

        // Aggregate team members: owner + all members
        const teamMap = new Map();

        // 1. Add Owner
        if (project.owner) {
          teamMap.set(project.owner._id.toString(), {
            userId: project.owner._id.toString(),
            name: project.owner.name,
            email: project.owner.email,
            profileImage: project.owner.profileImage || '',
            role: 'owner',
            completedTasksCount: 0,
            contributionPercentage: 0,
            activities: {
              created: 0,
              updated: 0,
              assigned: 0,
              completed: 0
            }
          });
        }

        // 2. Add Members
        for (const m of project.members) {
          if (m.user) {
            const uId = m.user._id.toString();
            if (!teamMap.has(uId)) {
              teamMap.set(uId, {
                userId: uId,
                name: m.user.name,
                email: m.user.email,
                profileImage: m.user.profileImage || '',
                role: m.role,
                completedTasksCount: 0,
                contributionPercentage: 0,
                activities: {
                  created: 0,
                  updated: 0,
                  assigned: 0,
                  completed: 0
                }
              });
            }
          }
        }

        // 3. Count unique completed tasks per developer
        // Rule 5: We query current completed tasks in DB, preventing double counting of reopened tasks!
        tasks.forEach((task) => {
          if (task.status === 'Completed' && task.assignedTo) {
            const devId = task.assignedTo._id.toString();
            if (teamMap.has(devId)) {
              teamMap.get(devId).completedTasksCount += 1;
            }
          }
        });

        // 4. Calculate contribution percentage for each team member
        teamMap.forEach((member) => {
          if (completedTasks > 0) {
            member.contributionPercentage = Math.round(
              (member.completedTasksCount / completedTasks) * 100
            );
          } else {
            member.contributionPercentage = 0;
          }
        });

        // 5. Query operational activity counts from ProjectActivity for this project
        const projectActivities = await ProjectActivity.find({
          projectId: project._id
        }).select('action actor relatedUserIds');

        projectActivities.forEach((act) => {
          const actorId = act.actor ? act.actor.toString() : null;

          if (actorId && teamMap.has(actorId)) {
            const memberStats = teamMap.get(actorId).activities;
            if (act.action === 'TASK_CREATED') {
              memberStats.created += 1;
            } else if (
              act.action === 'TASK_UPDATED' ||
              act.action === 'TASK_STATUS_CHANGED' ||
              act.action === 'TASK_REOPENED'
            ) {
              memberStats.updated += 1;
            } else if (
              act.action === 'TASK_ASSIGNED' ||
              act.action === 'TASK_REASSIGNED'
            ) {
              memberStats.assigned += 1;
            } else if (act.action === 'TASK_COMPLETED') {
              memberStats.completed += 1;
            }
          }

          // If a member was assigned/reassigned as relatedUser, tally for them if not already actor
          if (
            (act.action === 'TASK_ASSIGNED' || act.action === 'TASK_REASSIGNED') &&
            Array.isArray(act.relatedUserIds)
          ) {
            act.relatedUserIds.forEach((rId) => {
              const relId = rId.toString();
              if (relId !== actorId && teamMap.has(relId)) {
                teamMap.get(relId).activities.assigned += 1;
              }
            });
          }
        });

        return {
          _id: project._id,
          name: project.name,
          status: project.status,
          createdAt: project.createdAt,
          userRole: currentUserRole,
          totalTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks,
          overallCompletionPercentage,
          team: Array.from(teamMap.values())
        };
      })
    );

    res.status(200).json(projectContributions);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({
      message: 'Failed to fetch contribution metrics.',
      error: error.message
    });
  }
});

/**
 * GET /contributions/timeline
 * Fetches chronological project activities with optional filters.
 */
router.get('/timeline', async (req, res) => {
  try {
    const {
      projectId,
      developerId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 25
    } = req.query;

    const accessibleProjectIds = await getAccessibleProjectIds(req.user._id);

    if (accessibleProjectIds.length === 0) {
      return res.status(200).json({
        activities: [],
        total: 0,
        page: Number(page),
        totalPages: 0
      });
    }

    // Build filter query
    const filter = {};

    // 1. Project filter (must be an accessible project)
    if (projectId) {
      const isAllowed = accessibleProjectIds.some(
        (id) => id.toString() === projectId.toString()
      );
      if (!isAllowed) {
        return res.status(403).json({
          message: 'You do not have access to activities for this project.'
        });
      }
      filter.projectId = projectId;
    } else {
      filter.projectId = { $in: accessibleProjectIds };
    }

    // 2. Developer filter (as actor or relatedUser)
    if (developerId) {
      filter.$or = [
        { actor: developerId },
        { relatedUserIds: developerId }
      ];
    }

    // 3. Action filter
    if (action && action !== 'All') {
      filter.action = action;
    }

    // 4. Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [activities, total] = await Promise.all([
      ProjectActivity.find(filter)
        .populate('actor', '_id name email profileImage')
        .populate('relatedUserIds', '_id name email profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ProjectActivity.countDocuments(filter)
    ]);

    // Collect any user IDs in changes that need name resolution
    const userIdSet = new Set();
    const isObjectId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);

    activities.forEach((act) => {
      if (Array.isArray(act.changes)) {
        act.changes.forEach((c) => {
          if (c.field === 'assignedTo' || c.field === 'members') {
            if (isObjectId(c.from)) userIdSet.add(c.from);
            if (isObjectId(c.to)) userIdSet.add(c.to);
            if (c.to && typeof c.to === 'object' && isObjectId(c.to.user)) {
              userIdSet.add(c.to.user.toString());
            }
          }
        });
      }
    });

    const userNameMap = new Map();
    if (userIdSet.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(userIdSet) } }).select('_id name');
      users.forEach((u) => userNameMap.set(u._id.toString(), u.name));
    }

    const enrichedActivities = activities.map((act) => {
      const actObj = act.toObject ? act.toObject() : act;

      const relatedMap = new Map();
      if (Array.isArray(actObj.relatedUserIds)) {
        actObj.relatedUserIds.forEach((u) => {
          if (u && u._id && u.name) {
            relatedMap.set(u._id.toString(), u.name);
          }
        });
      }

      if (actObj.actor && actObj.actor._id && actObj.actor.name) {
        relatedMap.set(actObj.actor._id.toString(), actObj.actor.name);
      }

      if (Array.isArray(actObj.changes)) {
        actObj.changes = actObj.changes.map((c) => {
          if (c.field === 'assignedTo') {
            const resolveName = (val) => {
              if (!val) return val;
              const strVal = val.toString();
              return userNameMap.get(strVal) || relatedMap.get(strVal) || val;
            };

            return {
              ...c,
              from: resolveName(c.from),
              to: resolveName(c.to)
            };
          }

          if (c.field === 'members') {
            const resolveMember = (val) => {
              if (!val) return val;
              if (typeof val === 'object' && val.user) {
                const uId = val.user.toString();
                const uName = userNameMap.get(uId) || relatedMap.get(uId) || uId;
                return `${uName} (${val.role || 'developer'})`;
              }
              const strVal = val.toString();
              return userNameMap.get(strVal) || relatedMap.get(strVal) || val;
            };

            return {
              ...c,
              from: resolveMember(c.from),
              to: resolveMember(c.to)
            };
          }

          return c;
        });
      }

      return actObj;
    });

    res.status(200).json({
      activities: enrichedActivities,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Error fetching contribution timeline:', error);
    res.status(500).json({
      message: 'Failed to fetch activity timeline.',
      error: error.message
    });
  }
});

/**
 * GET /contributions/filters
 * Returns accessible projects, team developers, and action types for filter dropdowns.
 */
router.get('/filters', async (req, res) => {
  try {
    const accessibleProjects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    })
      .populate('owner', '_id name email')
      .populate('members.user', '_id name email')
      .select('_id name owner members');

    const projectsList = accessibleProjects.map((p) => ({
      _id: p._id,
      name: p.name
    }));

    // Collect distinct developers across accessible projects
    const developerMap = new Map();

    accessibleProjects.forEach((p) => {
      if (p.owner) {
        developerMap.set(p.owner._id.toString(), {
          _id: p.owner._id.toString(),
          name: p.owner.name,
          email: p.owner.email
        });
      }
      if (Array.isArray(p.members)) {
        p.members.forEach((m) => {
          if (m.user) {
            developerMap.set(m.user._id.toString(), {
              _id: m.user._id.toString(),
              name: m.user.name,
              email: m.user.email
            });
          }
        });
      }
    });

    const actionTypes = [
      { key: 'TASK_CREATED', label: 'Task Created' },
      { key: 'TASK_UPDATED', label: 'Task Updated' },
      { key: 'TASK_STATUS_CHANGED', label: 'Status Changed' },
      { key: 'TASK_COMPLETED', label: 'Task Completed' },
      { key: 'TASK_REOPENED', label: 'Task Reopened' },
      { key: 'TASK_ASSIGNED', label: 'Task Assigned' },
      { key: 'TASK_REASSIGNED', label: 'Task Reassigned' },
      { key: 'TASK_UNASSIGNED', label: 'Task Unassigned' },
      { key: 'TASK_DELETED', label: 'Task Deleted' },
      { key: 'PROJECT_CREATED', label: 'Project Created' },
      { key: 'PROJECT_UPDATED', label: 'Project Updated' },
      { key: 'PROJECT_DELETED', label: 'Project Deleted' },
      { key: 'MEMBER_ADDED', label: 'Member Added' },
      { key: 'MEMBER_REMOVED', label: 'Member Removed' }
    ];

    res.status(200).json({
      projects: projectsList,
      developers: Array.from(developerMap.values()),
      actionTypes
    });
  } catch (error) {
    console.error('Error fetching contribution filter options:', error);
    res.status(500).json({
      message: 'Failed to fetch filter options.',
      error: error.message
    });
  }
});

export default router;
