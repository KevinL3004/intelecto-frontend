import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Paginated } from '../http/api-error';
import { Rol } from '../auth/auth.models';

export interface Persona {
  id: number;
  nombres: string;
  apellidos: string;
  nit: string;
  dpi: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
}
export type PersonaForm = {
  nombres: string;
  apellidos?: string;
  nit?: string;
  dpi?: string;
  telefono?: string;
  correo?: string;
};

export interface Parametro {
  clave: string;
  valor: string;
  descripcion: string | null;
  actualizadoEn: string;
}

export interface UsuarioAdmin {
  id: number;
  username: string;
  rol: Rol;
  personaId: number;
  persona: Persona;
  colegioId: number | null;
  colegio: { id: number; nombre: string } | null;
  debeCambiarPassword: boolean;
  bloqueadoHasta: string | null;
  ultimoAcceso: string | null;
  activo: boolean;
}

export interface Caja {
  id: number;
  colegioId: number;
  colegio: { id: number; nombre: string };
  numero: number;
  fondoAsignado: string;
  activa: boolean;
}

/** Cliente HTTP de usuarios, personas y cajas. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // Personas
  personas(q = '', page = 1, limit = 20) {
    const params = new HttpParams().set('q', q).set('page', page).set('limit', limit);
    return this.http.get<Paginated<Persona>>(`${this.api}/personas`, { params });
  }
  crearPersona(dto: PersonaForm) {
    return this.http.post<Persona>(`${this.api}/personas`, dto);
  }
  editarPersona(id: number, dto: Partial<PersonaForm>) {
    return this.http.patch<Persona>(`${this.api}/personas/${id}`, dto);
  }
  eliminarPersona(id: number) {
    return this.http.delete<{ resultado: 'ELIMINADO' | 'DESACTIVADO' }>(
      `${this.api}/personas/${id}`,
    );
  }

  // Usuarios
  usuarios(q = '', rol: Rol | '' = '', page = 1, limit = 20) {
    let params = new HttpParams().set('q', q).set('page', page).set('limit', limit);
    if (rol) params = params.set('rol', rol);
    return this.http.get<Paginated<UsuarioAdmin>>(`${this.api}/usuarios`, { params });
  }
  crearUsuario(dto: {
    persona: PersonaForm;
    username: string;
    password: string;
    rol: Rol;
    colegioId?: number | null;
  }) {
    return this.http.post<{ id: number }>(`${this.api}/usuarios`, dto);
  }
  editarUsuario(id: number, dto: { rol?: Rol; colegioId?: number | null; activo?: boolean }) {
    return this.http.patch<UsuarioAdmin>(`${this.api}/usuarios/${id}`, dto);
  }
  resetPassword(id: number, password: string) {
    return this.http.patch<{ ok: true }>(`${this.api}/usuarios/${id}/password`, { password });
  }

  // Cajas
  cajas(colegioId?: number | null) {
    let params = new HttpParams();
    if (colegioId) params = params.set('colegioId', colegioId);
    return this.http.get<Caja[]>(`${this.api}/cajas`, { params });
  }
  crearCaja(dto: { colegioId: number; numero: number; fondoAsignado?: string }) {
    return this.http.post<Caja>(`${this.api}/cajas`, dto);
  }
  editarCaja(id: number, dto: { numero?: number; fondoAsignado?: string; activa?: boolean }) {
    return this.http.patch<Caja>(`${this.api}/cajas/${id}`, dto);
  }
  eliminarCaja(id: number) {
    return this.http.delete<{ resultado: 'ELIMINADO' | 'DESACTIVADO' }>(`${this.api}/cajas/${id}`);
  }

  parametros() {
    return this.http.get<Parametro[]>(`${this.api}/config/parametros`);
  }
  editarParametro(clave: string, valor: string) {
    return this.http.patch<Parametro>(
      `${this.api}/config/parametros/${encodeURIComponent(clave)}`,
      {
        valor,
      },
    );
  }
}
