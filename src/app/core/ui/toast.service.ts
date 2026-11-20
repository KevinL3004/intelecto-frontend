import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  tipo: 'ok' | 'error' | 'info';
  texto: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  ok(texto: string) {
    this.push('ok', texto);
  }
  error(texto: string) {
    this.push('error', texto, 6000);
  }
  info(texto: string) {
    this.push('info', texto);
  }
  cerrar(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  private push(tipo: Toast['tipo'], texto: string, ms = 3500) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, tipo, texto }]);
    setTimeout(() => this.cerrar(id), ms);
  }
}
