import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Contadores de trabajo pendiente (GET /avisos). El cajero solo recibe entregasPendientes. */
export interface Avisos {
  entregasPendientes: number;
  turnosPorValidar?: number;
  trasladosPorRecibir?: number;
  trasladosPorDespachar?: number;
  unidadesPorTrasladar?: number;
  unidadesPorPedir?: number;
  correosFallidos?: number;
}

/** Avisos del menú: se consultan al entrar, cada minuto y al cambiar de pantalla. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly http = inject(HttpClient);
  readonly avisos = signal<Avisos | null>(null);
  private timer?: ReturnType<typeof setInterval>;
  private ultimo = 0;

  iniciar() {
    this.refrescar(true);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refrescar(true), 60_000);
  }

  detener() {
    clearInterval(this.timer);
    this.avisos.set(null);
  }

  /** Sin `forzar`, no consulta más de una vez cada 10 s (p. ej. al navegar rápido). */
  refrescar(forzar = false) {
    if (!forzar && Date.now() - this.ultimo < 10_000) return;
    this.ultimo = Date.now();
    this.http
      .get<Avisos>(`${environment.apiUrl}/avisos`)
      .subscribe({ next: (a) => this.avisos.set(a), error: () => undefined });
  }
}
