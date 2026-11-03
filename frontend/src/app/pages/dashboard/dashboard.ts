import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DashboardService,
  ProjectStats
} from '../../services/dashboard';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  readonly pageTitle = 'Dashboard';
  readonly pageSubtitle = 'Track your projects, tasks, and progress in one place.';
  private readonly notificationService = inject(NotificationService);
  loadFailed = signal(false);

  projectStats = signal<ProjectStats[]>([]);
  loading = signal(true);

  get totalProjects(): number {
    return this.projectStats().length;
  }

  get totalTasks(): number {
    return this.projectStats().reduce(
      (total, project) => total + project.totalTasks,
      0
    );
  }

  get completedTasks(): number {
    return this.projectStats().reduce(
      (total, project) => total + project.completedTasks,
      0
    );
  }

  get inProgressTasks(): number {
    return this.projectStats().reduce(
      (total, project) => total + project.inProgressTasks,
      0
    );
  }

  get pendingTasks(): number {
    return this.projectStats().reduce(
      (total, project) => total + project.pendingTasks,
      0
    );
  }

  getCompletionPercentage(project: ProjectStats): number {
    if (project.totalTasks === 0) {
      return 0;
    }

    return Math.round(
      (project.completedTasks / project.totalTasks) * 100
    );
  }

  get overallCompletionPercentage(): number {
    const total = this.totalTasks;

    if (total === 0) {
      return 0;
    }

    return Math.round(
      (this.completedTasks / total) * 100
    );
  }

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadProjectStats();
  }

  loadProjectStats(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.dashboardService.getProjectStats().subscribe({
      next: (data) => {
        this.projectStats.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load dashboard:', error);

        this.notificationService.error(
          error.error?.message || 'Unable to load dashboard statistics.',
          'Dashboard loading failed'
        );

        this.loadFailed.set(true);
        this.loading.set(false);
      }
    });
  }
}
