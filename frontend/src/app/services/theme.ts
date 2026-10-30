
import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'devtrack-theme';

  readonly theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  toggleTheme(): void {
    const nextTheme: Theme =
      this.theme() === 'light' ? 'dark' : 'light';

    this.theme.set(nextTheme);
    this.applyTheme(nextTheme);
  }

  private getInitialTheme(): Theme {
    try {
      return localStorage.getItem(this.storageKey) === 'dark'
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  }

  private applyTheme(theme: Theme): void {
    this.document.documentElement.setAttribute('data-theme', theme);

    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
      // The theme still works for the current session.
    }
  }
}
