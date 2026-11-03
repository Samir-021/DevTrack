
import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notificationList = signal<Notification[]>([]);

  readonly notifications = this.notificationList.asReadonly();

  private nextId = 0;

  show(
    type: NotificationType,
    title: string,
    message: string,
    duration = 4000
  ): void {
    const id = ++this.nextId;

    const notification: Notification = {
      id,
      type,
      title,
      message
    };

    this.notificationList.update(current => [
      ...current,
      notification
    ]);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  }

  success(message: string, title = 'Success'): void {
    this.show('success', title, message);
  }

  error(message: string, title = 'Something went wrong'): void {
    this.show('error', title, message);
  }

  warning(message: string, title = 'Warning'): void {
    this.show('warning', title, message);
  }

  info(message: string, title = 'Information'): void {
    this.show('info', title, message);
  }

  dismiss(id: number): void {
    this.notificationList.update(current =>
      current.filter(notification => notification.id !== id)
    );
  }
}
