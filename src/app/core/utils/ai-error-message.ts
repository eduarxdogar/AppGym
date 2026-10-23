import { InbodyValidationError } from '../models/inbody-scan.schema';

export function aiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof InbodyValidationError) return error.message;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  switch (code) {
    case 'functions/resource-exhausted': return 'Límite de IA alcanzado. Intenta de nuevo en unos minutos.';
    case 'functions/permission-denied': return 'Tu suscripción o período de prueba no están vigentes. Revisa tu acceso en Suscripción.';
    case 'functions/unauthenticated': return 'Inicia sesión de nuevo para utilizar la IA.';
    case 'functions/invalid-argument': return 'La solicitud no es válida o es demasiado grande. Reduce el texto o el archivo e inténtalo de nuevo.';
    case 'functions/deadline-exceeded':
    case 'functions/unavailable': return 'La IA no está disponible en este momento. Intenta de nuevo en unos minutos.';
    default: return fallback;
  }
}
