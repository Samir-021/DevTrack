import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  private apiUrl = 'http://localhost:3000/dashboard';

  constructor(private http: HttpClient) {}

  getProjectStats(): Observable<ProjectStats[]> {
    return this.http.get<ProjectStats[]>(
      `${this.apiUrl}/projects`
    );
  }
}