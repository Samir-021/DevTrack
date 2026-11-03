import { Component, inject, signal, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification';


@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile {
  private readonly authService = inject(AuthService);

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly saving = signal(false);
  protected readonly profileImage = signal('');
  protected readonly imagePreview = signal('');
  protected readonly uploadingImage = signal(false);
  private readonly notificationService = inject(NotificationService);

  constructor() {
    const user = this.authService.getUser();

    if (user) {
      this.name.set(user.name);
      this.email.set(user.email);
      this.profileImage.set(user.profileImage ?? '');
    }
  }

  protected saveProfile(): void {
    if (this.saving()) {
      return;
    }

    const name = this.name().trim();
    const email = this.email().trim().toLowerCase();

    if (name.length < 2 || name.length > 80) {
      this.notificationService.warning(
        'Name must be between 2 and 80 characters.',
        'Invalid name'
      );
      return;
    }

    const atIndex = email.indexOf('@');
    const lastDotIndex = email.lastIndexOf('.');

    const isValidEmail =
      atIndex > 0 &&
      lastDotIndex > atIndex + 1 &&
      lastDotIndex < email.length - 1 &&
      !/\s/.test(email);

    if (email.length > 254 || !isValidEmail) {
      this.notificationService.warning(
        'Enter a valid email address.',
        'Invalid email'
      );
      return;
    }

    this.saving.set(true);

    this.authService.updateProfile(name, email).subscribe({
      next: (response) => {
        this.name.set(response.user.name);
        this.email.set(response.user.email);

        this.notificationService.success(
          response.message || 'Your profile has been updated.',
          'Profile updated'
        );

        this.saving.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.notificationService.error(
          error.error?.message ??
            'Unable to update your profile. Please try again.',
          'Profile update failed'
        );

        this.saving.set(false);
      }
    });
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.notificationService.warning(
        'Only JPG, PNG, and WebP images are allowed.',
        'Unsupported image format'
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.notificationService.warning(
        'Image must be 5 MB or smaller.',
        'Image too large'
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      this.imagePreview.set(reader.result as string);
    };

    reader.readAsDataURL(file);

    this.uploadingImage.set(true);

    this.authService.uploadProfileImage(file).subscribe({
      next: (response) => {
        this.profileImage.set(
          response.user.profileImage ?? ''
        );

        this.imagePreview.set('');

        this.notificationService.success(
          'Profile picture uploaded successfully.',
          'Profile picture updated'
        );

        this.uploadingImage.set(false);
      },

      error: (error: HttpErrorResponse) => {
        this.notificationService.error(
          error.error?.message ??
            'Unable to upload profile picture. Please try again.',
          'Profile picture upload failed'
        );

        this.uploadingImage.set(false);
        this.imagePreview.set('');
      }
    });
  }
}