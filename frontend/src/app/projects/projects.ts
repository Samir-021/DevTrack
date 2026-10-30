
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProjectApi,
  Project,
  ProjectRole,
  ProjectMember
} from './project-api';
import { AuthService } from '../services/auth';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.css'
})

export class Projects {
  projects = signal<Project[]>([]);
  editingProject = signal<Project | null>(null);
  loading = signal(false);
  errorMessage = signal('');
  memberMessage = signal('');
  currentUserId: string | null;

  constructor(
    private projectApi: ProjectApi,
    private authService: AuthService
  ) {
    this.currentUserId = this.authService.getUser()?.id ?? null;
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.projectApi.getProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load projects:', error);
        this.errorMessage.set('Unable to load projects. Please try again.');
        this.loading.set(false);
      }
    });
  }

  isOwner(project: Project): boolean {
    const ownerId =
      typeof project.owner === 'string'
        ? project.owner
        : project.owner?._id;

    return !!this.currentUserId && ownerId === this.currentUserId;
  }

  createProject(name: string, status: string): void {
    if (!name.trim() || !status) {
      this.errorMessage.set('Please enter a project name and select a status.');
      return;
    }

    this.errorMessage.set('');

    this.projectApi.createProject({
      name: name.trim(),
      status
    }).subscribe({
      next: () => {
        this.loadProjects();
      },
      error: (error) => {
        console.error('Failed to create project:', error);
        this.errorMessage.set(
          error.error?.message ?? 'Failed to create project.'
        );
      }
    });
  }

  deleteProject(id: string): void {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    this.projectApi.deleteProject(id).subscribe({
      next: () => {
        if (this.editingProject()?._id === id) {
          this.editingProject.set(null);
        }
        this.loadProjects();
      },
      error: (error) => {
        console.error('Failed to delete project:', error);
        this.errorMessage.set(
          error.error?.message ?? 'Failed to delete project.'
        );
      }
    });
  }

  editProject(project: Project): void {
    this.errorMessage.set('');
    this.editingProject.set(project);
  }

  saveProject(name: string, status: string): void {
    const project = this.editingProject();

    if (!project || !name.trim() || !status) {
      this.errorMessage.set('Please enter a project name and select a status.');
      return;
    }

    this.errorMessage.set('');

    this.projectApi.updateProject(project._id, {
      name: name.trim(),
      status
    }).subscribe({
      next: () => {
        this.editingProject.set(null);
        this.loadProjects();
      },
      error: (error) => {
        console.error('Failed to update project:', error);
        this.errorMessage.set(
          error.error?.message ?? 'Failed to update project.'
        );
      }
    });
  }

  cancelEdit(): void {
    this.editingProject.set(null);
    this.errorMessage.set('');
  }

  getMemberName(member: ProjectMember): string {
    return typeof member.user === 'string'
      ? member.user
      : member.user.name;
  }

  getMemberEmail(member: ProjectMember): string {
    return typeof member.user === 'string'
      ? ''
      : member.user.email;
  }

  addMember(projectId: string, email: string, role: string): void {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      this.memberMessage.set('Please enter the member email.');
      return;
    }

    if (role !== 'developer' && role !== 'viewer') {
      this.memberMessage.set('Please select a valid role.');
      return;
    }

    this.memberMessage.set('Adding member...');

    this.projectApi.addMember(
      projectId,
      normalizedEmail,
      role as ProjectRole
    ).subscribe({
      next: (response) => {
        this.memberMessage.set(response.message);
        this.loadProjects();
      },
      error: (error) => {
        this.memberMessage.set(
          error.error?.message ?? 'Failed to add member.'
        );
        console.error('Failed to add member:', error);
      }
    });
  }

  removeMember(projectId: string, member: ProjectMember): void {
    const userId =
      typeof member.user === 'string'
        ? member.user
        : member.user._id;

    if (!userId) {
      this.memberMessage.set('Could not identify this member.');
      return;
    }

    if (!confirm(`Remove ${this.getMemberName(member)} from this project?`)) {
      return;
    }

    this.memberMessage.set('Removing member...');

    this.projectApi.removeMember(projectId, userId).subscribe({
      next: (response) => {
        this.memberMessage.set(response.message);
        this.loadProjects();
      },
      error: (error) => {
        this.memberMessage.set(
          error.error?.message ?? 'Failed to remove member.'
        );
        console.error('Failed to remove member:', error);
      }
    });
  }
  
  get inProgressProjectCount(): number {
    return this.projects().filter(
      project => project.status === 'In Progress'
    ).length;
  }

  get completedProjectCount(): number {
    return this.projects().filter(
      project => project.status === 'Completed'
    ).length;
  }
  
  scrollToCreateProject(): void {
    document.getElementById('create-project')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}
