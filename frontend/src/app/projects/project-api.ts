import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ProjectUser {
  _id: string;
  name: string;
  email: string;
}

export type ProjectRole = 'developer' | 'viewer';

export interface ProjectMember {
  user: ProjectUser | string;
  role: ProjectRole;
  _id?: string;
}

export interface Project {
  _id: string;
  name: string;
  status: string;
  owner?: ProjectUser | string;
  members?: ProjectMember[];
}

export interface AddMemberResponse {
  message: string;
  project: Project;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectApi {
  private apiUrl = 'http://localhost:3000/projects';

  constructor(private http: HttpClient) {}

  getProjects() {
    return this.http.get<Project[]>(this.apiUrl);
  }

  createProject(project: {
    name: string;
    status: string;
  }) {
    return this.http.post<Project>(this.apiUrl, project);
  }

  updateProject(
    id: string,
    project: {
      name: string;
      status: string;
    }
  ) {
    return this.http.put<Project>(
      `${this.apiUrl}/${id}`,
      project
    );
  }

  deleteProject(id: string) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  addMember(
    projectId: string,
    email: string,
    role: ProjectRole
  ) {
    return this.http.post<AddMemberResponse>(
      `${this.apiUrl}/${projectId}/members`,
      { email, role }
    );
  }
    
  removeMember(projectId: string, userId: string) {
    return this.http.delete<AddMemberResponse>(
      `${this.apiUrl}/${projectId}/members/${userId}`
    );
  }

}