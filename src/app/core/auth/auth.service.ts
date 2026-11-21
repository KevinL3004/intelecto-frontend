import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize, Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, Rol, Usuario } from './auth.models';

const K_ACCESS = 'svi.access';
const K_REFRESH = 'svi.refresh';
const K_USER = 'svi.usuario';

/**
 * La sesión vive en sessionStorage: se borra al cerrar la pestaña y no se comparte con otras.
 * Limpia también lo que versiones anteriores dejaban en localStorage.
 */
const almacen = sessionStorage;
[K_ACCESS, K_REFRESH, K_USER].forEach((k) => localStorage.removeItem(k));

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = environment.apiUrl;
  /** Refresh en curso: las peticiones que fallen a la vez esperan este mismo. */
  private refrescando$: Observable<LoginResponse> | null = null;

  private readonly _usuario = signal<Usuario | null>(this.leerUsuario());
  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => !!this._usuario());

  get accessToken(): string | null {
    return almacen.getItem(K_ACCESS);
  }
  get refreshToken(): string | null {
    return almacen.getItem(K_REFRESH);
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/login`, { username, password })
      .pipe(tap((r) => this.guardarSesion(r)));
  }

  refresh(): Observable<LoginResponse> {
    this.refrescando$ ??= this.http
      .post<LoginResponse>(`${this.api}/auth/refresh`, { refresh_token: this.refreshToken })
      .pipe(
        tap((r) => this.guardarSesion(r)),
        finalize(() => (this.refrescando$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refrescando$;
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
    almacen.setItem(K_USER, JSON.stringify(nuevo));
    this._usuario.set(nuevo);
  }

  /** Cierra la sesión también en el servidor (revoca el refresh token), salvo que ya no sea válida. */
  logout(avisarServidor = true) {
    const token = this.accessToken;
    if (avisarServidor && token) {
      this.http
        .post(
          `${this.api}/auth/logout`,
          {},
          {
            headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
          },
        )
        .subscribe({ error: () => undefined });
    }
    [K_ACCESS, K_REFRESH, K_USER].forEach((k) => almacen.removeItem(k));
    this._usuario.set(null);
    this.router.navigate(['/login']);
  }

  private guardarSesion(r: LoginResponse) {
    almacen.setItem(K_ACCESS, r.access_token);
    almacen.setItem(K_REFRESH, r.refresh_token);
    almacen.setItem(K_USER, JSON.stringify(r.usuario));
    this._usuario.set(r.usuario);
  }

  private leerUsuario(): Usuario | null {
    try {
      return JSON.parse(almacen.getItem(K_USER) ?? 'null');
    } catch {
      return null;
    }
  }
}
