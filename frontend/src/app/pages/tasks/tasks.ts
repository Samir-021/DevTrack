import { Component, OnInit, signal, inject  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskService, Project, TaskPayload, User } from '../../services/task';
import { ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.html',
  styleUrl: './tasks.css'
})

export class Tasks implements OnInit {
  tasks = signal<Task[]>([]);
  projects = signal<Project[]>([]);
  loading = signal(true);
  creating = signal(false);
  priority: 'Low' | 'Medium' | 'High' = 'Medium';

  title = '';
  status = 'Pending';
  projectId = '';
  assignedTo = '';
  editingTaskId: string | null = null;
  dueDate = '';
  selectedDependencies: string[] = [];
  searchTerm = '';
  selectedStatus = 'All';
  selectedPriority = 'All';
  sortBy = 'priority';
  selectedProjectId = '';
  selectedDueDate = 'All';
  viewMode = signal<'list' | 'kanban'>('list');
  draggedTask = signal<Task | null>(null);
  dragOverStatus = signal<string | null>(null);
  taskFormOpen = signal(false);
  private readonly notificationService = inject(NotificationService);

  get filteredTasks(): Task[] {
    const filtered = this.tasks().filter((task) => {
      const matchesSearch = task.title
        .toLowerCase()
        .includes(this.searchTerm.toLowerCase());

      const matchesStatus =
        this.selectedStatus === 'All' ||
        task.status === this.selectedStatus;

      const taskProjectId =
        typeof task.projectId === 'string'
          ? task.projectId
          : task.projectId?._id;

      const matchesProject =
        this.selectedProjectId === '' ||
        taskProjectId === this.selectedProjectId;

      const matchesPriority =
        this.selectedPriority === 'All' ||
        (task.priority ?? 'Medium') === this.selectedPriority;
      
      const dueDateStatus = this.getDueDateStatus(task);
      const matchesDueDate = 
        this.selectedDueDate === 'All' ||
        dueDateStatus === this.selectedDueDate;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProject &&
        matchesPriority &&
        matchesDueDate
      );
    });

    const priorityRank: Record<string, number> = {
      High: 1,
      Medium: 2,
      Low: 3
    };

    return filtered.sort((a, b) => {
      if (this.sortBy === 'priority') {
        return (
          (priorityRank[a.priority ?? 'Medium'] ?? 2) -
          (priorityRank[b.priority ?? 'Medium'] ?? 2)
        );
      }

      if (this.sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }

      if (this.sortBy === 'title-desc') {
        return b.title.localeCompare(a.title);
      }

      return 0;
    });
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'Completed') {
      return false;
    }

    const today = new Date();
    const dueDate = new Date(task.dueDate);

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }

  getDueDateStatus(task: Task): string {
  if (!task.dueDate) {
    return 'No deadline';
  }

  if (task.status === 'Completed') {
    return 'Completed';
  }

  const today = new Date();
  const dueDate = new Date(task.dueDate);

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return 'Overdue';
  }

  if (dueDate.getTime() === today.getTime()) {
    return 'Due today';
  }

  return 'Upcoming';
}

  get totalTaskCount(): number {
    return this.tasks().length;
  }

  get pendingTaskCount(): number {
    return this.tasks().filter(
      task => task.status === 'Pending'
    ).length;
  }

  get inProgressTaskCount(): number {
    return this.tasks().filter(
      task => task.status === 'In Progress'
    ).length;
  }

  get completedTaskCount(): number {
    return this.tasks().filter(
      task => task.status === 'Completed'
    ).length;
  }

  get overdueTaskCount(): number {
    return this.tasks().filter(
      task => this.isOverdue(task)
    ).length;
  }
  get availableDependencyTasks(): Task[] {
    return this.tasks().filter(task => {
      const taskProjectId =
        typeof task.projectId === 'string'
          ? task.projectId
          : task.projectId?._id;

      return (
        taskProjectId === this.projectId &&
        task._id !== this.editingTaskId
      );
    });
  }

  openCreateTask(): void {
    // Reset any previous editing or form data.
    this.cancelEdit();

    // Keep the currently selected project, if one exists.
    this.projectId = this.selectedProjectId;

    // Open the modal.
    this.taskFormOpen.set(true);
  }
  
  onProjectChange(): void {
    this.assignedTo = '';
    this.selectedDependencies = [];
  }
    get availableAssignees(): User[] {
    const selectedProject = this.projects().find(
      project => project._id === this.projectId
    );

    if (!selectedProject) {
      return [];
    }

    const eligibleUsers: User[] = [];

    // The project owner is eligible.
    if (selectedProject.owner) {
      eligibleUsers.push(selectedProject.owner);
    }

    // Only developer members are eligible.
    const developers =
      selectedProject.members?.filter(
        member => member.role === 'developer'
      ) ?? [];

    for (const member of developers) {
      if (
        !eligibleUsers.some(
          user => user._id === member.user._id
        )
      ) {
        eligibleUsers.push(member.user);
      }
    }

    return eligibleUsers;
  }

  getAssigneeName(assignedTo: Task['assignedTo']): string {
    if (!assignedTo) {
      return 'Unassigned';
    }

    if (typeof assignedTo === 'string') {
      return 'Unknown user';
    }

    return assignedTo.name;
  }

  getDependencyTitle(dependency: string | Task): string {
    if (typeof dependency !== 'string') {
      return dependency.title;
    }

    return this.tasks().find(task => task._id === dependency)?.title
      ?? 'Task details unavailable';
  }

  getDependencyStatus(dependency: string | Task): string {
    if (typeof dependency !== 'string') {
      return dependency.status;
    }

    return this.tasks().find(task => task._id === dependency)?.status
      ?? 'Unknown';
  }
  canCompleteTask(): boolean {
  return this.selectedDependencies.every(dependencyId => {
    const dependency = this.tasks().find(
      task => task._id === dependencyId
    );

    return dependency?.status === 'Completed';
  });
}
  //karbon_reusing existing system
  get pendingTasks(): Task[] {
    return this.filteredTasks.filter(
      task => task.status === 'Pending'
    );
  }

  get inProgressTasks(): Task[] {
    return this.filteredTasks.filter(
      task => task.status === 'In Progress'
    );
  }

  get completedTasks(): Task[] {
    return this.filteredTasks.filter(
      task => task.status === 'Completed'
    );
  }

  onDragStart(event: DragEvent, task: Task): void {
    this.draggedTask.set(task);

    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', task._id ?? '');
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragEnd(): void {
  this.draggedTask.set(null);
  this.dragOverStatus.set(null);
  }

  onDragOver(event: DragEvent, status: string): void {
    event.preventDefault();
    this.dragOverStatus.set(status);
  }

  onDrop(event: DragEvent, newStatus: string): void {
    event.preventDefault();

    const task = this.draggedTask();

    if (!task || !task._id) {
      this.onDragEnd();
      return;
    }

    // Ignore drops into the task's current column.
    if (task.status === newStatus) {
      this.onDragEnd();
      return;
    }

    // Get the project ID.
    const projectId =
      typeof task.projectId === 'string'
        ? task.projectId
        : task.projectId?._id ?? '';

    // Get the assigned user's ID.
    const assignedTo =
      typeof task.assignedTo === 'string'
        ? task.assignedTo
        : task.assignedTo?._id ?? null;

    // Preserve existing dependencies.
    const dependencies =
      task.dependencies?.map(dependency =>
        typeof dependency === 'string'
          ? dependency
          : dependency._id!
      ) ?? [];

    // Build the complete update payload.
    const updatedTask: TaskPayload = {
      title: task.title,
      status: newStatus,
      priority: task.priority ?? 'Medium',
      projectId,
      dueDate: task.dueDate,
      assignedTo,
      dependencies
    };

    this.taskService.updateTask(task._id, updatedTask).subscribe({
      next: () => {
        this.onDragEnd();

        this.notificationService.success('Task status updated successfully!');

        this.loadTasks();
      },

      error: (error) => {
        console.error('Failed to update task status:', error);

        this.notificationService.error(
          error.error?.message ||
          'Failed to update task status.'
        );

        this.onDragEnd();

        // Restore the board using the server's actual task data.
        this.loadTasks();
      }
    });
  }
  constructor(
    private taskService: TaskService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadTasks();
    this.loadProjects();
    this.route.queryParamMap.subscribe(params => {
      this.selectedProjectId = params.get('projectId') ?? '';
    });
  }

  loadTasks(): void {
    this.loading.set(true);
    this.taskService.getTasks().subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load tasks:', error);
        this.notificationService.error('Unable to load tasks.');
        this.loading.set(false);
      }
    });
  }

  loadProjects(): void {
    this.taskService.getProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
      },
      error: (error) => {
        console.error('Failed to load projects:', error);

        this.notificationService.error(
          error.error?.message || 'Unable to load projects. Please try again.',
          'Project loading failed'
        );
      }
    });
  }

  createTask(): void {
    if (this.creating()) {
      return;
    }

    if (!this.title.trim() || !this.projectId) {
      this.notificationService.warning(
        'Please enter a task title and select a project.',
        'Missing required information'
      );
      return;
    }

    this.creating.set(true);

    const newTask: TaskPayload = {
      title: this.title.trim(),
      status: this.status,
      projectId: this.projectId,
      priority: this.priority,
      dueDate: this.dueDate,
      assignedTo: this.assignedTo || null,
      dependencies: this.selectedDependencies
    };

    this.taskService.createTask(newTask).subscribe({
      next: (task) => {
        this.tasks.update(currentTasks => [...currentTasks, task]);
        this.creating.set(false);
        this.cancelEdit();
        this.notificationService.success('Task created successfully!');
      },
      error: (error) => {
        console.error('Failed to create task:', error);
        this.creating.set(false);
        this.notificationService.error(
          error.error?.message || 'Failed to create task. Please try again.',
          'Task creation failed'
        );
      }
    });
  }
  
  editTask(task: Task): void {
    if (!task._id) return;
    
    this.editingTaskId = task._id;
    this.title = task.title;
    this.status = task.status;
    this.priority = task.priority ?? 'Medium';
    this.assignedTo =
    typeof task.assignedTo === 'string'
      ? task.assignedTo
      : task.assignedTo?._id ?? '';
    this.selectedDependencies =
      task.dependencies?.map(dependency =>
        typeof dependency === 'string'
          ? dependency
          : dependency._id!
      ) ?? [];

    this.dueDate = task.dueDate
      ? task.dueDate.substring(0,10)
      : '';

    this.projectId =
      typeof task.projectId === 'string'
        ? task.projectId
        : task.projectId?._id ?? '';
    
    this.taskFormOpen.set(true);
  }
  

  saveTask(): void {
    if (this.creating()) {
      return;
    }

    if (!this.editingTaskId || !this.title.trim() || !this.projectId) {
      this.notificationService.warning(
        'Please enter a task title and select a project.',
        'Missing required information'
      );
      return;
    }

    const updatedTask: TaskPayload = {
      title: this.title.trim(),
      status: this.status,
      projectId: this.projectId,
      priority: this.priority,
      dueDate: this.dueDate,
      assignedTo: this.assignedTo || null,
      dependencies: this.selectedDependencies
    };

    this.creating.set(true);

    this.taskService.updateTask(this.editingTaskId, updatedTask).subscribe({
      next: () => {
        this.creating.set(false);
        this.cancelEdit();

        this.notificationService.success(
          'Task updated successfully!'
        );

        this.loadTasks();
      },

      error: (error) => {
        console.error('Update failed:', error);

        this.creating.set(false);

        this.notificationService.error(
          error.error?.message ||
          `Failed to update task (HTTP ${error.status}).`,
          'Task update failed'
        );
      }
    });
  }


  cancelEdit(): void {
    this.editingTaskId = null;
    this.title = '';
    this.status = 'Pending';
    this.projectId = '';
    this.priority = 'Medium';
    this.dueDate = '';
    this.assignedTo = '';
    this.selectedDependencies = [];
    // Close the modal.
    this.taskFormOpen.set(false);
  }

  deleteTask(task: Task): void {
    if (!task._id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) return;

    this.taskService.deleteTask(task._id).subscribe({
      next: () => {
        this.tasks.update(currentTasks =>
          currentTasks.filter(item => item._id !== task._id)
        );
        this.notificationService.success('Task deleted successfully!');
      },
      error: (error) => {
        console.error('Failed to delete task:', error);
            this.notificationService.error(
            error.error?.message || 'Failed to delete task.',
            'Task deletion failed'
          );
      }
    });
  }

  getProjectName(projectId: string | Project): string {
    if (typeof projectId !== 'string') {
      return projectId.name;
    }

    const project = this.projects().find(
      item => item._id === projectId
    );

    return project?.name ?? 'Unknown project';
  }
}