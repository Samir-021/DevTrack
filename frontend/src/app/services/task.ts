import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Task {
  _id?: string;
  title: string;
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  projectId: string | Project;
  dependencies?: Task[];
}

export interface TaskPayload {
  title: string;
  status: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  projectId: string;
  dependencies: string[];
}

export interface Project {
  _id?: string;
  name: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = 'http://localhost:3000/tasks';
  private projectsUrl = 'http://localhost:3000/projects';

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