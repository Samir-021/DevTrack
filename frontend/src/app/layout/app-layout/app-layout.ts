
import { Component, signal, inject } from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router
} from '@angular/router';
import { AuthService } from '../../services/auth';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { ThemeService } from '../../services/theme';

interface LayoutUser {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css'
})
export class AppLayout {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);
  protected readonly sidebarOpen = signal(false);
  protected readonly currentUser = signal<LayoutUser | null>(
    this.authService.getUser()
  );

  protected get userInitial(): string {
    const name = this.currentUser()?.name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update(open => !open);
  }

  protected logout(): void {
    this.authService.logout();
    this.currentUser.set(null);
    this.closeSidebar();
    void this.router.navigateByUrl('/login');
  }

  constructor() {
  this.router.events
    .pipe(
      filter((event) => event instanceof NavigationEnd)
    )
    .subscribe(() => {
      this.currentUser.set(this.authService.getUser());
    });
}
}
