import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginated } from '../http/api-error';

export interface Libro {
  id: number;
  isbn: string | null;
  titulo: string;
  editorial: string | null;
  activo: boolean;
}
export type LibroForm = {
  titulo: string;
  isbn?: string | null;
  editorial?: string | null;
  activo?: boolean;
};

export interface Grado {
  id: number;
  nombre: string;
  nivel: string;
  orden: number;
  activo: boolean;
}

export interface FilaPrecio {
  libroId: number;
  isbn: string | null;
  titulo: string;
  editorial: string | null;
  precio: string | null;
}
export interface ListaPrecios {
  colegioId: number;
  ciclo: number;
  items: FilaPrecio[];
}

export interface LineaCombo {
  libroId: number;
  titulo: string;
  isbn: string | null;
  cantidad: number;
  precio: string | null;
}
export interface Combo {
  id: number;
  colegioId: number;
  gradoId: number;
  grado: Grado;
  ciclo: number;
  nombre: string;
  descuento: string;
  activo: boolean;
  libros: LineaCombo[];
  subtotal: string;
  total: string;
  completo: boolean;
}
export interface ComboForm {
  colegioId?: number;
  gradoId?: number;
  ciclo?: number;
  nombre?: string;
  descuento?: string;
  activo?: boolean;
  libros?: { libroId: number; cantidad: number }[];
}

export interface FilaInventario {
  libroId: number;
  isbn: string | null;
  titulo: string;
  editorial: string | null;
  existencia: number;
  reservado: number;
  disponible: number;
  pendientes: number;
  excedente: number;
}
export interface Movimiento {
  id: number;
  libroId: number;
  libro: Libro;
  tipo: string;
  cantidad: number;
  referencia: string | null;
  motivo: string | null;
  fecha: string;
}

/** Cliente HTTP del catálogo (libros, precios, combos) e inventario. */
@Injectable({ providedIn: 'root' })
export class CatalogoApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // Configuración
  cicloActual() {
    return this.http
      .get<{ clave: string; valor: string }[]>(`${this.api}/config/parametros`)
      .pipe(
        map(
          (ps) =>
            Number(ps.find((p) => p.clave === 'ciclo_actual')?.valor) || new Date().getFullYear(),
        ),
      );
  }
  grados() {
    return this.http.get<Grado[]>(`${this.api}/grados`);
  }

  // Libros
  libros(q = '', page = 1, limit = 20, activo?: boolean) {
    let params = new HttpParams().set('q', q).set('page', page).set('limit', limit);
    if (activo !== undefined) params = params.set('activo', String(activo));
    return this.http.get<Paginated<Libro>>(`${this.api}/libros`, { params });
  }
  crearLibro(dto: LibroForm) {
    return this.http.post<Libro>(`${this.api}/libros`, dto);
  }
  editarLibro(id: number, dto: Partial<LibroForm>) {
    return this.http.patch<Libro>(`${this.api}/libros/${id}`, dto);
  }
  eliminarLibro(id: number) {
    return this.http.delete<{ resultado: 'ELIMINADO' | 'DESACTIVADO' }>(`${this.api}/libros/${id}`);
  }

  // Precios
  precios(colegioId: number | null, ciclo: number) {
    let params = new HttpParams().set('ciclo', ciclo);
    if (colegioId) params = params.set('colegioId', colegioId);
    return this.http.get<ListaPrecios>(`${this.api}/precios`, { params });
  }
  guardarPrecios(
    colegioId: number,
    ciclo: number,
    items: { libroId: number; precio: string | null }[],
  ) {
    return this.http.put<{ cambios: number }>(`${this.api}/precios`, { colegioId, ciclo, items });
  }
  copiarPrecios(dto: {
    colegioOrigenId: number;
    cicloOrigen: number;
    colegioDestinoId: number;
    cicloDestino: number;
    sobrescribir: boolean;
  }) {
    return this.http.post<{ copiados: number }>(`${this.api}/precios/copiar`, dto);
  }

  // Combos
  combos(colegioId: number | null, ciclo: number) {
    let params = new HttpParams().set('ciclo', ciclo);
    if (colegioId) params = params.set('colegioId', colegioId);
    return this.http
      .get<{ items: Combo[] }>(`${this.api}/combos`, { params })
      .pipe(map((r) => r.items));
  }
  crearCombo(dto: ComboForm) {
    return this.http.post<Combo>(`${this.api}/combos`, dto);
  }
  editarCombo(id: number, dto: ComboForm) {
    return this.http.patch<Combo>(`${this.api}/combos/${id}`, dto);
  }
  eliminarCombo(id: number) {
    return this.http.delete<{ resultado: string }>(`${this.api}/combos/${id}`);
  }

  // Inventario
  inventario(colegioId: number | null, q = '', soloConExistencia = false) {
    let params = new HttpParams().set('q', q).set('soloConExistencia', soloConExistencia);
    if (colegioId) params = params.set('colegioId', colegioId);
    return this.http.get<FilaInventario[]>(`${this.api}/inventario`, { params });
  }
  movimientos(colegioId: number | null, libroId: number, page = 1, limit = 20) {
    let params = new HttpParams().set('libroId', libroId).set('page', page).set('limit', limit);
    if (colegioId) params = params.set('colegioId', colegioId);
    return this.http.get<Paginated<Movimiento>>(`${this.api}/inventario/movimientos`, { params });
  }
  ingreso(dto: {
    colegioId: number;
    referencia?: string;
    motivo?: string;
    items: { libroId: number; cantidad: number }[];
  }) {
    return this.http.post<{ items: { libroId: number; existencia: number }[] }>(
      `${this.api}/inventario/ingreso`,
      dto,
    );
  }
  ajuste(dto: { colegioId: number; libroId: number; existencia: number; motivo: string }) {
    return this.http.post<{ existencia: number; diferencia: number }>(
      `${this.api}/inventario/ajuste`,
      dto,
    );
  }
}
