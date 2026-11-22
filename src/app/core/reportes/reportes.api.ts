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
export type Riesgo = 'CRITICO' | 'ALTO' | 'MEDIO' | 'OK';
export interface FilaCobertura {
  colegioId: number;
  colegio: string;
  libroId: number;
  titulo: string;
  editorial: string | null;
  disponible: number;
  pendientes: number;
  enCamino: number;
  vendidos7: number;
  vendidos28: number;
  demandaDiaria: number;
  diasCobertura: number | null;
  faltante: number;
  excedente: number;
  riesgo: Riesgo;
}
export interface Sugerencia {
  tipo: 'TRASLADO' | 'PEDIDO';
  libroId: number;
  titulo: string;
  editorial: string | null;
  destinoId: number;
  destino: string;
  origenId: number | null;
  origen: string | null;
  cantidad: number;
  riesgo: Riesgo;
  motivo: string;
  proveedorId: number | null;
  proveedor: string | null;
}
export interface Abastecimiento {
  horizonteDias: number;
  filas: FilaCobertura[];
  sugerencias: Sugerencia[];
  proveedores: { id: number; nombre: string }[];
}
export interface Alerta {
  nivel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'INFO';
  titulo: string;
  detalle: string;
  accion?: 'abastecimiento' | 'pendientes' | 'cuadres' | 'pedidos' | 'traslados';
}
export interface Analisis {
  periodo: { dias: number; colegioId: number | null };
  kpis: {
    ingresos: string;
    ingresosVar: number | null;
    ventas: number;
    ventasVar: number | null;
    ticketPromedio: string;
    ticketVar: number | null;
    unidades: number;
    alumnos: number;
    recargos: string;
    descuentos: string;
    anuladas: number;
    montoAnulado: string;
  };
  serie: { dia: string; total: string; ventas: number }[];
  pronostico: { dia: string; esperado: number; min: number; max: number }[];
  proyeccion: {
    dias: number;
    esperado: string;
    min: string;
    max: string;
    tendenciaSemanalPct: number | null;
    errorDiario: number | null;
  };
  porColegio: { id: number; colegio: string; ingresos: string; ventas: number; ticket: string }[];
  porMetodo: { metodo: string; pagos: number; base: string; recargo: string; total: string }[];
  porGrado: { grado: string; alumnos: number; unidades: number; ingresos: string }[];
  topLibros: {
    titulo: string;
    unidades: number;
    ingresos: string;
    ultimos7: number;
    previos7: number;
  }[];
  pendientes: {
    unidades: number;
    ventas: number;
    monto: string;
    antiguedad: { tramo: string; unidades: number }[];
    porEstado: { estado: string; unidades: number }[];
  };
  caja: {
    turnos: number;
    faltantes: number;
    montoFaltante: string;
    sobrantes: number;
    montoSobrante: string;
    porValidar: number;
  };
  abastecimiento: Abastecimiento;
  alertas: Alerta[];
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
  analisis(dias: number, colegioId?: number | null) {
    let params = new HttpParams().set('dias', dias);
    if (colegioId) params = params.set('colegioId', colegioId);
    return this.http.get<Analisis>(`${this.api}/reportes/analisis`, { params });
  }
  abastecimiento(colegioId?: number | null) {
    const params = colegioId ? new HttpParams().set('colegioId', colegioId) : undefined;
    return this.http.get<Abastecimiento>(`${this.api}/reportes/abastecimiento`, { params });
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
