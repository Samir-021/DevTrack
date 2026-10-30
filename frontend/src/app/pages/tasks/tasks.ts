
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskService, Project, TaskPayload } from '../../services/task';
import { ActivatedRoute } from '@angular/router';

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
  errorMessage = signal('');
  successMessage = signal('');
  creating = signal(false);
  priority: 'Low' | 'Medium' | 'High' = 'Medium';

  title = '';
  status = 'Pending';
  projectId = '';
  editingTaskId: string | null = null;
  dueDate = '';
  selectedDependencies: string[] = [];
  searchTerm = '';
  selectedStatus = 'All';
  selectedPriority = 'All';
  sortBy = 'priority';
  selectedProjectId = '';
  selectedDueDate = 'All';
  
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
    this.errorMessage.set('');
    

    this.taskService.getTasks().subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load tasks:', error);
        this.errorMessage.set('Unable to load tasks.');
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
      }
    });
  }

  createTask(): void {
    if (!this.title.trim() || !this.projectId || this.creating()) {
      return;
    }

    this.creating.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const newTask: TaskPayload = {
      title: this.title.trim(),
      status: this.status,
      projectId: this.projectId,
      priority: this.priority,
      dueDate: this.dueDate,
      dependencies: this.selectedDependencies
    };

    this.taskService.createTask(newTask).subscribe({
      next: (task) => {
        this.tasks.update(currentTasks => [...currentTasks, task]);
        this.title = '';
        this.status = 'Pending';
        this.selectedDependencies = [];
        this.successMessage.set('Task created successfully!');
        this.creating.set(false);
      },
      error: (error) => {
        console.error('Failed to create task:', error);
        this.errorMessage.set('Failed to create task. Please try again.');
        this.creating.set(false);
      }
    });
  }
  
  editTask(task: Task): void {
    if (!task._id) return;

    this.editingTaskId = task._id;
    this.title = task.title;
    this.status = task.status;
    this.priority = task.priority ?? 'Medium';
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
  }
  

  saveTask(): void {
    if (!this.editingTaskId || !this.title.trim() || !this.projectId) {
      return;
    }

    const updatedTask: TaskPayload = {
      title: this.title.trim(),
      status: this.status,
      projectId: this.projectId,
      priority: this.priority,
      dueDate: this.dueDate,
      dependencies: this.selectedDependencies
    };

    this.errorMessage.set('');
    this.successMessage.set('');

    this.taskService.updateTask(this.editingTaskId, updatedTask).subscribe({
      next: () => {
        this.editingTaskId = null;
        this.title = '';
        this.status = 'Pending';
        this.projectId = '';
        this.dueDate = '';
        this.selectedDependencies = [];

        this.successMessage.set('Task updated successfully!');
        this.loadTasks();
      },
      error: (error) => {
        console.error('Update failed. HTTP status:', error.status);
        console.error('Server response:', error.error);
        console.error('Full error:', error);

        this.errorMessage.set(
          error.error?.message ||
          `Failed to update task (HTTP ${error.status}).`
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
    this.selectedDependencies = [];
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
        this.successMessage.set('Task deleted successfully!');
      },
      error: (error) => {
        console.error('Failed to delete task:', error);
        this.errorMessage.set('Failed to delete task.');
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

scrollToTaskForm(): void {
  document.getElementById('task-form')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

}
