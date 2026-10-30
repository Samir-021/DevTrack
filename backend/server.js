import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dns from 'dns';

import { Project } from './models/project.js';
import { Task } from './models/task.js';
import authRoutes from './routes/authRoutes.js';
import { authenticate } from './middleware/authMiddleware.js';
import { User } from './models/user.js';

const app = express();

dns.setServers(['1.1.1.1']);

const allowedOrigins = [
  'http://localhost:4200',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json());
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');

    app.listen(PORT, () => {
      console.log(`DevTrack backend server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
  });

app.get('/', (req, res) => {
  res.json({
    message: 'DevTrack backend is running'
  });
});

// Protected identity endpoint
app.get('/auth/me', authenticate, (req, res) => {
  res.json({
    message: 'You are authenticated.',
    user: req.user
  });
});

// Protect all API routes registered below this line.
app.use(authenticate);

async function getProjectAccess(projectId, userId) {
  const project = await Project.findById(projectId)
    .select('owner members');

  if (!project) {
    return { project: null, role: null };
  }

  // The project owner has full control.
  if (project.owner.toString() === userId.toString()) {
    return { project, role: 'owner' };
  }

  // Otherwise, check whether the user is a project member.
  const member = project.members.find(
    (member) => member.user.toString() === userId.toString()
  );

  return {
    project,
    role: member ? member.role : null
  };
}

function canEditTasks(role) {
  return role === 'owner' || role === 'developer';
}

function canManageProject(role) {
  return role === 'owner';
}

app.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    })
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      message: 'Failed to fetch projects.'
    });
  }
});


app.post('/projects', async (req, res) => {
  try {
    const { name, status } = req.body;

    if (!name || !status) {
      return res.status(400).json({
        message: 'Project name and status are required.'
      });
    }

    const project = await Project.create({
      name,
      status,
      owner: req.user._id
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      message: 'Failed to create project.'
    });
  }
});

app.put('/projects/:id', async (req, res) => {
  try {
    const { name, status } = req.body;

    if (!name || !status) {
      return res.status(400).json({
        message: 'Project name and status are required.'
      });
    }

    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.user._id
      },
      { name, status },
      {
        new: true,
        runValidators: true
      }
    );

    if (!project) {
      return res.status(404).json({
        message: 'Project not found or you do not have permission to update it.'
      });
    }

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    res.status(500).json({
      message: 'Failed to update project.'
    });
  }
});

app.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found or you do not have permission to delete it.'
      });
    }

    await Task.deleteMany({
      projectId: project._id
    });

    await Project.findByIdAndDelete(project._id);

    res.json({
      message: 'Project and its tasks deleted successfully.',
      project
    });

  } catch (error) {
    console.error('Delete project error:', error);

    res.status(500).json({
      message: 'Failed to delete project.',
      error: error.message
    });
  }
});

async function dependenciesAreCompleted(dependencyIds = []) {
  const ids = dependencyIds.map(id => id.toString());

  // Reject duplicate dependency IDs.
  if (new Set(ids).size !== ids.length) {
    return false;
  }

  if (ids.length === 0) {
    return true;
  }

  const dependencyTasks = await Task.find({
    _id: { $in: ids }
  }).select('_id status');

  // Every dependency must exist and be completed.
  return (
    dependencyTasks.length === ids.length &&
    dependencyTasks.every(task => task.status === 'Completed')
  );
}

async function wouldCreateCircularDependency(taskId, dependencyIds) {
  const visited = new Set();

  async function checkDependency(dependencyId) {
    const id = dependencyId.toString();

    // We reached the task we are currently editing.
    if (id === taskId.toString()) {
      return true;
    }

    // Already checked this task.
    if (visited.has(id)) {
      return false;
    }

    visited.add(id);

    const dependencyTask = await Task.findById(id)
      .select('_id dependencies');

    if (!dependencyTask) {
      return false;
    }

    for (const nestedDependency of dependencyTask.dependencies) {
      if (await checkDependency(nestedDependency)) {
        return true;
      }
    }

    return false;
  }

  for (const dependencyId of dependencyIds) {
    if (await checkDependency(dependencyId)) {
      return true;
    }
  }

  return false;
}

async function validateDependencies(
  dependencyIds,
  taskId = null,
  projectId,
  userId
) {
  // The user must either own the project
  // or be a member of the project.
  const project = await Project.findOne({
    _id: projectId,
    $or: [
      { owner: userId },
      { 'members.user': userId }
    ]
  }).select('_id');

  if (!project) {
    return 'Project does not exist or you do not have access to it.';
  }

  const ids = dependencyIds.map(id => id.toString());

  // Reject duplicate dependencies.
  if (new Set(ids).size !== ids.length) {
    return 'Duplicate dependency tasks are not allowed.';
  }

  // A task cannot depend on itself.
  if (taskId && ids.includes(taskId.toString())) {
    return 'A task cannot depend on itself.';
  }

  // No dependencies means there is nothing else to validate.
  if (ids.length === 0) {
    return null;
  }

  // Find all dependency tasks.
  const dependencyTasks = await Task.find({
    _id: { $in: ids }
  }).select('_id projectId');

  // Every dependency must exist.
  if (dependencyTasks.length !== ids.length) {
    return 'One or more dependency tasks do not exist.';
  }

  // All dependencies must belong to the same project.
  const wrongProject = dependencyTasks.some(
    dependency =>
      dependency.projectId.toString() !== projectId.toString()
  );

  if (wrongProject) {
    return 'Dependencies must belong to the same project.';
  }

  return null;
}

app.post('/tasks', async (req, res) => {
  try {
    const {
      title,
      status = 'Pending',
      priority = 'Medium',
      dueDate,
      projectId,
      dependencies = []
    } = req.body;

    // 1. Validate required fields.
    if (!title?.trim() || !projectId) {
      return res.status(400).json({
        message: 'Task title and project are required.'
      });
    }

    // 2. Validate dependencies input.
    if (!Array.isArray(dependencies)) {
      return res.status(400).json({
        message: 'Dependencies must be an array of task IDs.'
      });
    }

    // 3. Determine the user's role in this project.
    const { project, role } = await getProjectAccess(
      projectId,
      req.user._id
    );

    if (!project || !role) {
      return res.status(403).json({
        message: 'You do not have access to this project.'
      });
    }

    // 4. Only Owner and Developer can create tasks.
    if (!canEditTasks(role)) {
      return res.status(403).json({
        message: 'Viewers cannot create tasks.'
      });
    }

    // 5. Validate dependency IDs, self-dependency,
    // duplicate dependencies, and project membership.
    const dependencyError = await validateDependencies(
      dependencies,
      null,
      projectId,
      req.user._id
    );

    if (dependencyError) {
      return res.status(400).json({
        message: dependencyError
      });
    }

    // 6. A task can be completed only when
    // all its dependencies are completed.
    if (status === 'Completed') {
      const canComplete =
        await dependenciesAreCompleted(dependencies);

      if (!canComplete) {
        return res.status(400).json({
          message:
            'Complete all dependency tasks before completing this task.'
        });
      }
    }

    // 7. Create the task.
    const task = await Task.create({
      title: title.trim(),
      status,
      priority,
      dueDate: dueDate || undefined,
      projectId,
      dependencies
    });

    // 8. Populate project and dependency details.
    const populatedTask = await task.populate([
      { path: 'projectId', select: 'name' },
      { path: 'dependencies', select: 'title status priority' }
    ]);

    return res.status(201).json(populatedTask);

  } catch (error) {
    console.error('Error creating task:', error);

    return res.status(400).json({
      message: 'Failed to create task.',
      error: error.message
    });
  }
});


app.get('/tasks', async (req, res) => {
  try {
    // Find projects where the authenticated user is either:
    // 1. The owner, or
    // 2. A project member.
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    }).select('_id');

    const projectIds = projects.map(project => project._id);

    const tasks = await Task.find({
      projectId: { $in: projectIds }
    })
      .populate('projectId', 'name')
      .populate('dependencies', 'title status priority');

    res.status(200).json(tasks);

  } catch (error) {
    console.error('Error fetching tasks:', error);

    res.status(500).json({
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});


app.put('/tasks/:id', async (req, res) => {
  try {
    const {
      title,
      status,
      projectId,
      priority,
      dueDate,
      dependencies = []
    } = req.body;

    if (!title?.trim() || !projectId) {
      return res.status(400).json({
        message: 'Task title and project are required.'
      });
    }

    if (!Array.isArray(dependencies)) {
      return res.status(400).json({
        message: 'Dependencies must be an array of task IDs.'
      });
    }


    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found.'
      });
    }

    const { project, role } = await getProjectAccess(
      task.projectId,
      req.user._id
    );

    if (!project || !role) {
      return res.status(403).json({
        message: 'You do not have access to this task.'
      });
    }

    if (!canEditTasks(role)) {
      return res.status(403).json({
        message: 'Viewers cannot edit tasks.'
      });
    }

    // Prevent moving a task to a different project.
    // This protects dependencies in the original project.
    if (task.projectId._id.toString() !== projectId.toString()) {
      return res.status(400).json({
        message: 'A task cannot be moved to another project when editing.'
      });
    }
    // Validate dependency IDs, self-dependency,
    // duplicate dependencies, and project membership.
    const dependencyError = await validateDependencies(
      dependencies,
      task._id,
      projectId,
      req.user._id
    );

    if (dependencyError) {
      return res.status(400).json({
        message: dependencyError
      });
    }

    // Prevent circular dependencies.
    const createsCycle = await wouldCreateCircularDependency(
      task._id,
      dependencies
    );

    if (createsCycle) {
      return res.status(400).json({
        message: 'This dependency would create a circular dependency.'
      });
    }

    // Enforce the completion rule on the server.
    if (status === 'Completed') {
      const canComplete =
        await dependenciesAreCompleted(dependencies);

      if (!canComplete) {
        return res.status(400).json({
          message: 'Complete all dependency tasks before completing this task.'
        });
      }
    }


    task.title = title.trim();
    task.status = status;
    task.projectId = projectId;
    task.priority = priority;
    task.dueDate = dueDate || undefined;
    task.dependencies = dependencies;

    await task.save();

    const populatedTask = await task.populate([
      { path: 'projectId', select: 'name' },
      { path: 'dependencies', select: 'title status priority' }
    ]);

    return res.status(200).json(populatedTask);
  } catch (error) {
    console.error('Error updating task:', error);

    return res.status(400).json({
      message: 'Failed to update task.',
      error: error.message
    });
  }
});


app.delete('/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found.'
      });
    }

    // Check the user's role in the task's project.
    const { project, role } = await getProjectAccess(
      task.projectId,
      req.user._id
    );

    if (!project || !role) {
      return res.status(403).json({
        message: 'You do not have access to this task.'
      });
    }

    // Viewers have read-only access.
    if (!canEditTasks(role)) {
      return res.status(403).json({
        message: 'Viewers cannot delete tasks.'
      });
    }

    // Remove references to this task from other tasks
    // in the same project before deleting it.
    await Task.updateMany(
      {
        projectId: task.projectId,
        dependencies: task._id
      },
      {
        $pull: { dependencies: task._id }
      }
    );

    await Task.findByIdAndDelete(task._id);

    return res.status(200).json({
      message: 'Task deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting task:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid task ID.'
      });
    }

    return res.status(500).json({
      message: 'Failed to delete task.'
    });
  }
});

app.get('/dashboard/projects', async (req, res) => {
  try {
      const projects = await Project.find({
        $or: [
          { owner: req.user._id },
          { 'members.user': req.user._id }
        ]
      });

    const projectStats = await Promise.all(
      projects.map(async (project) => {
        const tasks = await Task.find({
          projectId: project._id
        });

        const totalTasks = tasks.length;

        const completedTasks = tasks.filter(
          task => task.status === 'Completed'
        ).length;

        const pendingTasks = tasks.filter(
          task => task.status === 'Pending'
        ).length;

        const inProgressTasks = tasks.filter(
          task => task.status === 'In Progress'
        ).length;
        
        return {
          _id: project._id,
          name: project.name,
          status: project.status,
          totalTasks,
          completedTasks,
          pendingTasks,
          inProgressTasks
        };
      })
    );

    res.status(200).json(projectStats);

  } catch (error) {
    console.error('Error fetching project statistics:', error);

    res.status(500).json({
      message: 'Failed to fetch project statistics',
      error: error.message
    });
  }
});


app.post('/projects/:id/members', async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({
        message: 'Member email is required.'
      });
    }

    if (!['developer', 'viewer'].includes(role)) {
      return res.status(400).json({
        message: 'Role must be developer or viewer.'
      });
    }

    // Only the project owner can add members.
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found or you are not the owner.'
      });
    }

    // Find an existing DevTrack account.
    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(404).json({
        message: 'No DevTrack user found with that email.'
      });
    }

    // The owner already has full access.
    if (user._id.toString() === project.owner.toString()) {
      return res.status(400).json({
        message: 'The project owner cannot be added as a member.'
      });
    }

    // Prevent duplicate membership.
    const alreadyMember = project.members.some(
      member => member.user.toString() === user._id.toString()
    );

    if (alreadyMember) {
      return res.status(409).json({
        message: 'This user is already a project member.'
      });
    }

    project.members.push({
      user: user._id,
      role
    });

    await project.save();

    await project.populate([
      { path: 'owner', select: 'name email' },
      { path: 'members.user', select: 'name email' }
    ]);

    return res.status(201).json({
      message: 'Project member added successfully.',
      project
    });
  } catch (error) {
    console.error('Add project member error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid project ID.'
      });
    }

    return res.status(500).json({
      message: 'Failed to add project member.'
    });
  }
});


app.delete('/projects/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;

    // Only the project owner can remove members.
    const project = await Project.findOne({
      _id: id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found or you are not the owner.'
      });
    }

    // Prevent removing the owner.
    if (userId === project.owner.toString()) {
      return res.status(400).json({
        message: 'The project owner cannot be removed as a member.'
      });
    }

    // Find the member to remove.
    const memberIndex = project.members.findIndex(
      member => member.user.toString() === userId
    );

    if (memberIndex === -1) {
      return res.status(404).json({
        message: 'This user is not a member of the project.'
      });
    }

    // Remove the member.
    project.members.splice(memberIndex, 1);

    await project.save();

    // Return the updated project with populated user details.
    await project.populate([
      { path: 'owner', select: 'name email' },
      { path: 'members.user', select: 'name email' }
    ]);

    return res.status(200).json({
      message: 'Project member removed successfully.',
      project
    });
  } catch (error) {
    console.error('Remove project member error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid project ID or user ID.'
      });
    }

    return res.status(500).json({
      message: 'Failed to remove project member.'
    });
  }
});
