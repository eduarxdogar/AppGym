import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';

export const securityInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Registrar el error real de forma segura (sin exponerlo a la UI)
      logger.error('HTTP Error in security interceptor:', error);

      // Mapear el error a un mensaje genérico para evitar fuga de información
      let genericErrorMessage = 'Ha ocurrido un error inesperado. Por favor, inténtalo más tarde.';

      if (error.status === 401 || error.status === 403) {
        genericErrorMessage = 'Acceso denegado o sesión expirada.';
      } else if (error.status >= 500) {
        genericErrorMessage = 'Error interno del servidor.';
      } else if (error.status === 404) {
        genericErrorMessage = 'Recurso no encontrado.';
      }

      // Propagar el error transformado
      return throwError(() => new Error(genericErrorMessage));
    })
  );
};
