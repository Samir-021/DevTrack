
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/theme';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly themeService = inject(ThemeService);
  name = '';
  email = '';
  password = '';

  errorMessage = '';
  successMessage = '';
  loading = false;

  onRegister(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.loading) {
      return;
    }

    const name = this.name.trim();
    const email = this.email.trim().toLowerCase();
    const password = this.password;

    // Validate name
    if (name.length < 2 || name.length > 80) {
      this.errorMessage =
        'Name must be between 2 and 80 characters.';
      return;
    }
    // Validate email
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      this.errorMessage =
        'Please provide a valid email address.';
      return;
    }

    // Validate password
    if (password.length < 8 || password.length > 72) {
      this.errorMessage =
        'Password must be between 8 and 72 characters.';
      return;
    }

    this.loading = true;

    this.authService
      .register(name, email, password)
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.successMessage = response.message;

          this.router.navigate(['/login'], {
            queryParams: { registered: 'true' }
          });
        },

        error: (error) => {
          this.loading = false;

          this.errorMessage =
            error.error?.message ??
            'Registration failed. Please try again.';
        }
      });
  }
}
