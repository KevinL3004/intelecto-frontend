import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Tema } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';

const KEY = 'svi.tema';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly tema = signal<Tema>((localStorage.getItem(KEY) as Tema) || 'system');

  constructor() {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.aplicar());
    const t = this.auth.usuario()?.tema;
    if (t && !localStorage.getItem(KEY)) this.set(t, false);
    this.aplicar();
  }

  /** Claro → oscuro → sistema */
  alternar() {
    const orden: Tema[] = ['light', 'dark', 'system'];
    this.set(orden[(orden.indexOf(this.tema()) + 1) % orden.length]);
  }

  set(t: Tema, guardarEnServidor = true) {
    this.tema.set(t);
    localStorage.setItem(KEY, t);
    this.aplicar();
    if (guardarEnServidor && this.auth.autenticado()) {
      this.http
        .patch(`${environment.apiUrl}/auth/tema`, { tema: t })
        .subscribe({ error: () => {} });
      this.auth.actualizarUsuario({ tema: t });
    }
  }

  private aplicar() {
    const t = this.tema();
    const dark =
      t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }
}
