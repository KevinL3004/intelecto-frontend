import { HttpErrorResponse } from '@angular/common/http';

/** Convierte el formato estándar de error del backend en un mensaje legible. */
export function mensajeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor. Intente de nuevo.';
    const m = e.error?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
  }
  return 'Ocurrió un error inesperado';
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
