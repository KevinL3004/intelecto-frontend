import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Paginated } from '../../../core/http/api-error';

export interface Colegio {
  id: number;
  codigo: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
}

export type ColegioForm = Pick<Colegio, 'codigo' | 'nombre'> &
  Partial<Pick<Colegio, 'direccion' | 'telefono' | 'activo'>>;

@Injectable({ providedIn: 'root' })
export class ColegiosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/colegios`;

  listar(q = '', page = 1, limit = 20) {
    const params = new HttpParams().set('q', q).set('page', page).set('limit', limit);
    return this.http.get<Paginated<Colegio>>(this.url, { params });
  }
  crear(dto: ColegioForm) {
    return this.http.post<Colegio>(this.url, dto);
  }
  editar(id: number, dto: Partial<ColegioForm>) {
    return this.http.patch<Colegio>(`${this.url}/${id}`, dto);
  }
  eliminar(id: number) {
    return this.http.delete<{ resultado: 'ELIMINADO' | 'DESACTIVADO' }>(`${this.url}/${id}`);
  }
}
