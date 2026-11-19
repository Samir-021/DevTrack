import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ContributionService,
  ProjectContribution,
  ProjectActivityItem,
  FilterOptionsResponse,
  ActivityChange
} from '../../services/contribution';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-contributions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contributions.html',
  styleUrl: './contributions.css'
})
export class Contributions implements OnInit {
  private readonly contributionService = inject(ContributionService);
  private readonly notificationService = inject(NotificationService);

  // Loading states
  loading = signal<boolean>(true);
  timelineLoading = signal<boolean>(false);

  // Data states
  projectContributions = signal<ProjectContribution[]>([]);
  activities = signal<ProjectActivityItem[]>([]);
  filterOptions = signal<FilterOptionsResponse | null>(null);

  // Set of collapsed project IDs (empty set = all expanded by default)
  collapsedProjectIds = signal<Set<string>>(new Set());

  // Filter signals
  selectedProjectId = signal<string>('');
  selectedDeveloperId = signal<string>('');
  selectedAction = signal<string>('All');
  startDate = signal<string>('');
  endDate = signal<string>('');

  // Pagination signals
  currentPage = signal<number>(1);
  pageSize = signal<number>(15);
  totalPages = signal<number>(1);
  totalActivities = signal<number>(0);

  // Computed summary metrics
  totalProjectsCount = computed(() => this.projectContributions().length);
  totalCompletedTasks = computed(() =>
    this.projectContributions().reduce((acc, p) => acc + p.completedTasks, 0)
  );

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadContributions();
    this.loadTimeline();
  }

  loadContributions(): void {
    this.loading.set(true);
    this.contributionService.getContributions().subscribe({
      next: (data) => {
        this.projectContributions.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load contributions:', err);
        this.notificationService.error(
          err.error?.message || 'Failed to load project contributions.',
          'Contributions Loading Error'
        );
        this.loading.set(false);
      }
    });
  }

  loadFilterOptions(): void {
    this.contributionService.getFilterOptions().subscribe({
      next: (options) => {
        this.filterOptions.set(options);
      },
      error: (err) => {
        console.error('Failed to load filter options:', err);
      }
    });
  }

  loadTimeline(): void {
    this.timelineLoading.set(true);

    this.contributionService
      .getTimeline({
        projectId: this.selectedProjectId() || undefined,
        developerId: this.selectedDeveloperId() || undefined,
        action: this.selectedAction() || undefined,
        startDate: this.startDate() || undefined,
        endDate: this.endDate() || undefined,
        page: this.currentPage(),
        limit: this.pageSize()
      })
      .subscribe({
        next: (res) => {
          this.activities.set(res.activities);
          this.totalPages.set(res.totalPages || 1);
          this.totalActivities.set(res.total);
          this.timelineLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load timeline:', err);
          this.notificationService.error(
            err.error?.message || 'Failed to load activity timeline.',
            'Timeline Loading Error'
          );
          this.timelineLoading.set(false);
        }
      });
  }

  toggleProjectCollapse(projectId: string): void {
    const currentSet = new Set(this.collapsedProjectIds());
    if (currentSet.has(projectId)) {
      currentSet.delete(projectId);
    } else {
      currentSet.add(projectId);
    }
    this.collapsedProjectIds.set(currentSet);
  }

  isProjectCollapsed(projectId: string): boolean {
    return this.collapsedProjectIds().has(projectId);
  }

  onProjectFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedProjectId.set(select.value);
    this.currentPage.set(1);
    this.loadTimeline();
  }

  onDeveloperFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedDeveloperId.set(select.value);
    this.currentPage.set(1);
    this.loadTimeline();
  }

  onActionFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedAction.set(select.value);
    this.currentPage.set(1);
    this.loadTimeline();
  }

  onStartDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.startDate.set(input.value);
    this.currentPage.set(1);
    this.loadTimeline();
  }

  onEndDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.endDate.set(input.value);
    this.currentPage.set(1);
    this.loadTimeline();
  }

  resetFilters(): void {
    this.selectedProjectId.set('');
    this.selectedDeveloperId.set('');
    this.selectedAction.set('All');
    this.startDate.set('');
    this.endDate.set('');
    this.currentPage.set(1);
    this.loadTimeline();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadTimeline();
    }
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'TASK_CREATED':
      case 'PROJECT_CREATED':
        return 'badge-created';
      case 'TASK_COMPLETED':
        return 'badge-completed';
      case 'TASK_REOPENED':
        return 'badge-reopened';
      case 'TASK_ASSIGNED':
      case 'TASK_REASSIGNED':
      case 'TASK_UNASSIGNED':
        return 'badge-assigned';
      case 'TASK_STATUS_CHANGED':
      case 'TASK_UPDATED':
      case 'PROJECT_UPDATED':
        return 'badge-updated';
      case 'TASK_DELETED':
      case 'PROJECT_DELETED':
      case 'MEMBER_REMOVED':
        return 'badge-deleted';
      case 'MEMBER_ADDED':
        return 'badge-member';
      default:
        return 'badge-default';
    }
  }

  getActionLabel(action: string): string {
    const map: Record<string, string> = {
      TASK_CREATED: 'Task Created',
      TASK_UPDATED: 'Task Updated',
      TASK_STATUS_CHANGED: 'Status Changed',
      TASK_COMPLETED: 'Task Completed',
      TASK_REOPENED: 'Task Reopened',
      TASK_ASSIGNED: 'Task Assigned',
      TASK_REASSIGNED: 'Task Reassigned',
      TASK_UNASSIGNED: 'Task Unassigned',
      TASK_DELETED: 'Task Deleted',
      PROJECT_CREATED: 'Project Created',
      PROJECT_UPDATED: 'Project Updated',
      PROJECT_DELETED: 'Project Deleted',
      MEMBER_ADDED: 'Member Added',
      MEMBER_REMOVED: 'Member Removed'
    };
    return map[action] || action;
  }

  formatFieldName(field: string): string {
    const map: Record<string, string> = {
      assignedTo: 'assignedTo',
      dueDate: 'Due Date',
      dependencies: 'Dependencies',
      members: 'Member',
      status: 'Status',
      priority: 'Priority',
      title: 'Title',
      name: 'Project Name'
    };
    return map[field] || field;
  }

  formatValue(field: string, value: any, activity?: ProjectActivityItem): string {
    if (value === null || value === undefined || value === '') {
      return '(empty)';
    }

    // If it's a 24-character ObjectId string and field is assignedTo
    if (field === 'assignedTo' && typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
      if (activity?.relatedUserIds) {
        const found = activity.relatedUserIds.find((u) => u._id === value);
        if (found?.name) return found.name;
      }
      if (activity?.actor && activity.actor._id === value) {
        return activity.actor.name;
      }
    }

    if (field === 'dependencies' && Array.isArray(value)) {
      if (value.length === 0) return '(none)';
      return `${value.length} task${value.length > 1 ? 's' : ''}`;
    }

    return String(value);
  }

  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }
}
