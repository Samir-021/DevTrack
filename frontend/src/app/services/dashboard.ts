import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface ProjectStats {
  _id: string;
  name: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private apiUrl = `${API_BASE_URL}/dashboard`;

  constructor(private http: HttpClient) {}

  getProjectStats(): Observable<ProjectStats[]> {
    return this.http.get<ProjectStats[]>(
      `${this.apiUrl}/projects`
    );
  }
}