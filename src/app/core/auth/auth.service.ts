import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, Rol, Usuario } from './auth.models';

const K_ACCESS = 'svi.access';
const K_REFRESH = 'svi.refresh';
const K_USER = 'svi.usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;

  private readonly _usuario = signal<Usuario | null>(this.leerUsuario());
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => !!this._usuario());

  get accessToken(): string | null {
    return localStorage.getItem(K_ACCESS);
  }
  get refreshToken(): string | null {
    return localStorage.getItem(K_REFRESH);
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/login`, { username, password })
      .pipe(tap((r) => this.guardarSesion(r)));
  }

  refresh(): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/refresh`, { refresh_token: this.refreshToken })
      .pipe(tap((r) => this.guardarSesion(r)));
  }

  cambiarPassword(actual: string, nueva: string) {
    return this.http
      .patch(`${this.api}/auth/password`, { actual, nueva })
      .pipe(tap(() => this.actualizarUsuario({ debeCambiarPassword: false })));
  }

  tieneRol(...roles: Rol[]): boolean {
    const u = this._usuario();
    return !!u && roles.includes(u.rol);
  }

  actualizarUsuario(cambios: Partial<Usuario>) {
    const u = this._usuario();
    if (!u) return;
    const nuevo = { ...u, ...cambios };
    localStorage.setItem(K_USER, JSON.stringify(nuevo));
    this._usuario.set(nuevo);
  }

  logout() {
    [K_ACCESS, K_REFRESH, K_USER].forEach((k) => localStorage.removeItem(k));
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  private guardarSesion(r: LoginResponse) {
    localStorage.setItem(K_ACCESS, r.access_token);
    localStorage.setItem(K_REFRESH, r.refresh_token);
    localStorage.setItem(K_USER, JSON.stringify(r.usuario));
    this._usuario.set(r.usuario);
  }

  private leerUsuario(): Usuario | null {
    try {
      return JSON.parse(localStorage.getItem(K_USER) ?? 'null');
    } catch {
      return null;
    }
  }
}
