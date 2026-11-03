
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

// Represents a user returned by the backend.
export interface User {
  _id: string;
  name: string;
  email: string;
}

// Represents a project member and their role.
export interface ProjectMember {
  user: User;
  role: 'developer' | 'viewer';
}

export interface Task {
  _id?: string;
  title: string;
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  projectId: string | Project;
  assignedTo?: string | User | null;
  dependencies?: Task[];
}

export interface TaskPayload {
  title: string;
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  projectId: string;
  assignedTo?: string | null;
  dependencies: string[];
}

export interface Project {
  _id?: string;
  name: string;
  status: string;
  owner?: User;
  members?: ProjectMember[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {

  private apiUrl = `${API_BASE_URL}/tasks`;
  private projectsUrl = `${API_BASE_URL}/projects`;

  constructor(private http: HttpClient) {}

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  createTask(task: TaskPayload): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, task);
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.projectsUrl);
  }

  updateTask(id: string, task: TaskPayload): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${id}`, task);
  }

  deleteTask(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/${id}`
    );
  }
}
