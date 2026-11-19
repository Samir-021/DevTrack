import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface ActivityChange {
  field: string;
  from: any;
  to: any;
}

export interface ActivityUser {
  _id: string;
  name: string;
  email: string;
  profileImage?: string;
}

export interface ProjectActivityItem {
  _id: string;
  projectId: string;
  projectNameSnapshot: string;
  taskId?: string | null;
  taskTitleSnapshot?: string | null;
  actor: ActivityUser;
  actorNameSnapshot: string;
  action: string;
  relatedUserIds?: ActivityUser[];
  changes?: ActivityChange[];
  createdAt: string;
  updatedAt?: string;
}

export interface TeamMemberContribution {
  userId: string;
  name: string;
  email: string;
  profileImage?: string;
  role: 'owner' | 'developer' | 'viewer';
  completedTasksCount: number;
  contributionPercentage: number;
  activities: {
    created: number;
    updated: number;
    assigned: number;
    completed: number;
  };
}

export interface ProjectContribution {
  _id: string;
  name: string;
  status: string;
  createdAt: string;
  userRole: 'owner' | 'developer' | 'viewer';
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overallCompletionPercentage: number;
  team: TeamMemberContribution[];
}

export interface TimelineFilterParams {
  projectId?: string;
  developerId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface TimelineResponse {
  activities: ProjectActivityItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface FilterOptionsResponse {
  projects: { _id: string; name: string }[];
  developers: { _id: string; name: string; email: string }[];
  actionTypes: { key: string; label: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class ContributionService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/contributions`;

  /**
   * Fetches projects with member contribution stats and activity metrics.
   */
  getContributions(): Observable<ProjectContribution[]> {
    return this.http.get<ProjectContribution[]>(this.apiUrl);
  }

  /**
   * Fetches chronological activity timeline with filtering and pagination.
   */
  getTimeline(filters?: TimelineFilterParams): Observable<TimelineResponse> {
    let params = new HttpParams();

    if (filters) {
      if (filters.projectId) {
        params = params.set('projectId', filters.projectId);
      }
      if (filters.developerId) {
        params = params.set('developerId', filters.developerId);
      }
      if (filters.action && filters.action !== 'All') {
        params = params.set('action', filters.action);
      }
      if (filters.startDate) {
        params = params.set('startDate', filters.startDate);
      }
      if (filters.endDate) {
        params = params.set('endDate', filters.endDate);
      }
      if (filters.page) {
        params = params.set('page', filters.page.toString());
      }
      if (filters.limit) {
        params = params.set('limit', filters.limit.toString());
      }
    }

    return this.http.get<TimelineResponse>(`${this.apiUrl}/timeline`, { params });
  }

  /**
   * Fetches available filter options (projects, developers, actions).
   */
  getFilterOptions(): Observable<FilterOptionsResponse> {
    return this.http.get<FilterOptionsResponse>(`${this.apiUrl}/filters`);
  }
}
