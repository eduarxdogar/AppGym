import { ErrorHandler, Injectable, isDevMode, inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);

  handleError(error: any): void {
    // Log the error securely (to an external service in prod, or console in dev)
    if (isDevMode()) {
      console.error('Unhandled Exception:', error);
    }
    this.logger.error('Unhandled exception caught by GlobalErrorHandler', error);

    // Evitar que el stack trace se propague al usuario final en producción
    // En una aplicación real, aquí podrías enviar el error a Sentry/Datadog.
  }
}
