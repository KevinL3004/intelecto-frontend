import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type TipoColumna = 'texto' | 'entero' | 'dinero' | 'fecha' | 'fechaHora';
export interface Columna {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
}
export interface Reporte {
  titulo: string;
  columnas: Columna[];
  filas: Record<string, unknown>[];
  totales: Record<string, string | number>;
  recortado: boolean;
}
export interface Dashboard {
  hoy: { ventas: number; total: string; recargo: string };
  porMetodo: { nombre: string; pagos: number; total: string }[];
  pendientes: { estado: string; unidades: number }[];
  cajasAbiertas: {
    id: number;
    estado: string;
    caja: number;
    colegio: string;
    cajero: string;
    abiertoEn: string;
  }[];
  turnosPorValidar: number;
  ultimos7: { dia: string; total: string }[];
}
export type Filtros = Partial<
  Record<
    | 'desde'
    | 'hasta'
    | 'colegioId'
    | 'cajaId'
    | 'usuarioId'
    | 'metodoPagoId'
    | 'estado'
    | 'entidad',
    string | number
  >
>;

@Injectable({ providedIn: 'root' })
export class ReportesApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private params(f: Filtros) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(f))
      if (v !== '' && v !== null && v !== undefined) p = p.set(k, v);
    return p;
  }
  dashboard(colegioId?: number | null) {
    const params = colegioId ? new HttpParams().set('colegioId', colegioId) : undefined;
    return this.http.get<Dashboard>(`${this.api}/reportes/dashboard`, { params });
  }
  reporte(tipo: string, f: Filtros) {
    return this.http.get<Reporte>(`${this.api}/reportes/${tipo}`, { params: this.params(f) });
  }
  excel(tipo: string, f: Filtros) {
    return this.http.get(`${this.api}/reportes/${tipo}`, {
      params: this.params({ ...f, formato: 'xlsx' } as Filtros),
      responseType: 'blob',
    });
  }
}
