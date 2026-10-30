
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/theme';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly themeService = inject(ThemeService);

  email = '';
  password = '';

  errorMessage = '';
  loading = false;

  registeredMessage =
    this.route.snapshot.queryParamMap.get('registered') === 'true'
      ? 'Account created successfully. Please log in.'
      : '';


    onLogin(): void {
      this.errorMessage = '';

      if (this.loading) {
        return;
      }

      this.loading = true;

      this.authService
        .login(this.email, this.password)
        .subscribe({
          next: () => {
            this.loading = false;
            this.router.navigate(['/dashboard']);
          },
          error: (error) => {
            this.loading = false;

            this.errorMessage =
              error.error?.message ??
              'Login failed. Please check your credentials.';

            console.error('Login failed:', error);
          }
        });
    }
}
