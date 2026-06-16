import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  public readonly toasts = this._toasts.asReadonly();
  private _idCounter = 0;

  show(message: string, type: ToastType = 'info', durationMs: number = 4000) {
    const id = this._idCounter++;
    const toast: Toast = { id, message, type };
    
    this._toasts.update(current => [...current, toast]);

    setTimeout(() => {
      this.remove(id);
    }, durationMs);
  }

  showSuccess(message: string, durationMs?: number) {
    this.show(message, 'success', durationMs);
  }

  showError(message: string, durationMs?: number) {
    this.show(message, 'error', durationMs);
  }

  showInfo(message: string, durationMs?: number) {
    this.show(message, 'info', durationMs);
  }

  showWarning(message: string, durationMs?: number) {
    this.show(message, 'warning', durationMs);
  }

  remove(id: number) {
    this._toasts.update(current => current.filter(t => t.id !== id));
  }
}
