import { Injectable, isDevMode } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  log(message: string, ...optionalParams: unknown[]): void {
    if (isDevMode()) {
      console.log(message, ...optionalParams);
    }
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    if (isDevMode()) {
      console.warn(message, ...optionalParams);
    }
  }

  error(message: string, ...optionalParams: unknown[]): void {
    if (isDevMode()) {
      console.error(message, ...optionalParams);
    } else { /* empty */
    }
  }
}
