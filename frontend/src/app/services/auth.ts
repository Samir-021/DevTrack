
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
}

export interface ProfileUpdateResponse {
  message: string;
  user: AuthUser & {
    createdAt?: string;
    updatedAt?: string;
  };
}

interface RegisterResponse {
  message: string;
  user: AuthUser;
}

interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);

  private apiUrl = `${API_BASE_URL}/auth`;

  // Register a new account.
  register(
    name: string,
    email: string,
    password: string
  ): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${this.apiUrl}/register`,
      { name, email, password }
    );
  }

  // Log in and save the JWT returned by the backend.
  login(
    email: string,
    password: string
  ): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, {
        email,
        password
      })
      .pipe(
        tap((response) => {
          localStorage.setItem('devtrack_token', response.token);
          localStorage.setItem(
            'devtrack_user',
            JSON.stringify(response.user)
          );
        })
      );
  }

  updateProfile(
    name: string,
    email: string
  ): Observable<ProfileUpdateResponse> {
    return this.http
      .put<ProfileUpdateResponse>(`${this.apiUrl}/profile`, {
        name,
        email
      })
      .pipe(
        tap((response) => {
          localStorage.setItem(
            'devtrack_user',
            JSON.stringify(response.user)
          );
        })
      );
  }

    uploadProfileImage(file: File): Observable<ProfileUpdateResponse> {
    const formData = new FormData();

    formData.append('image', file);

    return this.http
      .post<ProfileUpdateResponse>(
        `${this.apiUrl}/profile-image`,
        formData
      )
      .pipe(
        tap((response) => {
          localStorage.setItem(
            'devtrack_user',
            JSON.stringify(response.user)
          );
        })
      );
  }

  // Read the saved JWT.
  getToken(): string | null {
    return localStorage.getItem('devtrack_token');
  }

  // Check whether a token is saved.
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // Read the saved user's information.
  getUser(): AuthUser | null {
    const user = localStorage.getItem('devtrack_user');

    if (!user) {
      return null;
    }

    try {
      return JSON.parse(user) as AuthUser;
    } catch {
      return null;
    }
  }

  // Log out by clearing saved authentication data.
  logout(): void {
    localStorage.removeItem('devtrack_token');
    localStorage.removeItem('devtrack_user');
  }
}
