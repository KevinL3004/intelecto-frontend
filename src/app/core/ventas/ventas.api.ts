import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginated } from '../http/api-error';

export type EstadoTurno = 'ABIERTO' | 'EN_CIERRE' | 'CERRADO' | 'VALIDADO' | 'OBSERVADO';
export type EstadoLinea =
  | 'PENDIENTE_PROVEEDOR'
  | 'EN_PEDIDO'
  | 'PENDIENTE_TRASLADO'
  | 'EN_TRANSITO'
  | 'RESERVADO'
  | 'ENTREGADO'
  | 'ANULADO';

export interface Denominacion {
  id: number;
  valor: string;
  tipo: 'BILLETE' | 'MONEDA';
  orden: number;
}
export interface CajaDisponible {
  id: number;
  numero: number;
  colegioId: number;
  colegio: string;
  fondoAsignado: string;
}
export interface TurnoActual {
  id: number;
  estado: EstadoTurno;
  fondoInicial: string;
  abiertoEn: string;
  cajaId: number;
  cajaNumero: number;
  colegioId: number;
  colegio: string;
  conteoRegistrado: boolean;
}
export interface Conteo {
  denominacionId: number;
  cantidad: number;
}
export interface FilaConteo extends Conteo {
  momento: 'APERTURA' | 'CIERRE';
  valor: string;
  tipo: string;
  subtotal: string;
}
export interface Acta {
  id: number;
  estado: EstadoTurno;
  forzado: boolean;
  cajaNumero: number;
  colegio: string;
  username: string;
  cajero: string;
  cerradoPor: string | null;
  validadoPor: string | null;
  abiertoEn: string;
  cerradoEn: string | null;
  validadoEn: string | null;
  fondoInicial: string;
  observacionApertura: string | null;
  observacionCierre: string | null;
  observacionValidacion: string | null;
  conteoApertura: FilaConteo[];
  conteoCierre: FilaConteo[];
  resumen: {
    ventas: number;
    efectivoVentas: string | null;
    tarjeta: string;
    transferencia: string;
    retiros: string;
    ingresos: string;
    reembolsos: string;
    efectivoEsperado: string | null;
    efectivoContado: string | null;
    diferencia: string | null;
    fondoAConservar: string;
    efectivoAEntregar: string | null;
  };
  pagos: {
    id: number;
    venta: string;
    metodo: string;
    nombre: string;
    medio: string | null;
    referencia: string | null;
    montoTotal: string;
    anulado: boolean;
    fecha: string;
  }[];
  movimientos: {
    id: number;
    tipo: string;
    monto: string;
    motivo: string;
    usuario: string;
    fecha: string;
  }[];
}
export interface ResultadoCierre {
  estado: 'EN_CIERRE' | 'CERRADO';
  requiereObservacion?: boolean;
  motivo?: string;
  efectivoContado?: string;
  efectivoEsperado?: string;
  diferencia?: string;
  acta?: Acta;
}
export interface FilaTurno {
  id: number;
  estado: EstadoTurno;
  forzado: boolean;
  fondoInicial: string;
  efectivoEsperado: string | null;
  efectivoContado: string | null;
  diferencia: string | null;
  abiertoEn: string;
  cerradoEn: string | null;
  cajaNumero: number;
  colegio: string;
  username: string;
  cajero: string;
}

export interface Metodo {
  id: number;
  codigo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
  nombre: string;
  recargoPct: string;
  requiereReferencia: boolean;
}
export interface PagoEntrada {
  metodoPagoId: number;
  montoBase: string;
  recibido?: string;
  referencia?: string;
  medio?: 'TERMINAL' | 'LINK_PAGO' | 'OTRO';
  recargoPct?: string;
}
export interface LineaPlan {
  /** Índice del alumno (bloque) al que pertenece. */
  grupo: number;
  libroId: number;
  titulo: string;
  isbn: string | null;
  cantidad: number;
  precio: string | null;
  subtotal: string;
  estado: EstadoLinea | null;
  colegioOrigen: string | null;
  error: string | null;
}
export interface Cotizacion {
  colegioId: number;
  colegio: string;
  ciclo: number;
  lineas: LineaPlan[];
  grupos: { indice: number; subtotal: string; descuento: string; comboAplicado: boolean }[];
  subtotal: string;
  descuento: string;
  comboAplicado: boolean;
  aPagar: string;
  metodos: Metodo[];
  /** Total si el cliente paga TODO con cada método (calculado por el backend, RN-02). */
  totalSegunMetodo: {
    metodoPagoId: number;
    nombre: string;
    recargoPct: string;
    recargo: string;
    total: string;
  }[];
  pagos: {
    pagos: {
      metodoPagoId: number;
      nombre: string;
      montoBase: string;
      recargoPct: string;
      recargo: string;
      montoTotal: string;
      recibido: string | null;
      vuelto: string | null;
    }[];
    recargo: string;
    total: string;
    faltante: string;
    vuelto: string;
  } | null;
  errores: { error: string; message: string }[];
}
/** Útiles de un alumno dentro de la venta. */
export interface AlumnoVentaInput {
  alumnoId?: number;
  nombres?: string;
  apellidos?: string;
  gradoId?: number;
  comboId?: number;
  licencia?: string;
  lineas: { libroId: number; cantidad: number }[];
}
export interface VentaInput {
  colegioId?: number;
  comboId?: number;
  lineas?: { libroId: number; cantidad: number }[];
  alumnos?: AlumnoVentaInput[];
  entregarAhora?: boolean;
  pagos?: PagoEntrada[];
  clienteId?: number;
  alumno?: string;
  gradoId?: number;
  observacion?: string;
}
export interface Venta {
  id: number;
  codigo: string;
  colegioId: number;
  colegio: string;
  ciclo: number;
  clienteId: number;
  cliente: string;
  nit: string;
  clienteTelefono: string | null;
  clienteCorreo: string | null;
  alumno: string | null;
  grado: string | null;
  alumnos: AlumnoDeVenta[];
  correos: CorreoVenta[];
  subtotal: string;
  descuento: string;
  recargo: string;
  total: string;
  estadoPago: 'PAGADA' | 'ANULADA' | string;
  estadoEntrega: 'PENDIENTE' | 'PARCIAL' | 'COMPLETA';
  observacion: string | null;
  fecha: string;
  usuario: string;
  cajaNumero: number | null;
  motivoAnulacion: string | null;
  anuladaEn: string | null;
  anuladaPor: string | null;
  lineas: {
    id: number;
    ventaAlumnoId: number | null;
    libroId: number;
    titulo: string;
    isbn: string | null;
    cantidad: number;
    cantidadEntregada: number;
    precioUnitario: string;
    subtotal: string;
    estado: EstadoLinea;
    colegioOrigen: string | null;
  }[];
  pagos: {
    id: number;
    metodo: string;
    nombre: string;
    medio: string | null;
    montoBase: string;
    recargoPct: string;
    recargo: string;
    montoTotal: string;
    recibido: string | null;
    vuelto: string | null;
    referencia: string | null;
  }[];
}
export interface AlumnoDeVenta {
  /** id del alumno dentro de la venta (venta_alumno). */
  id: number;
  alumnoId: number;
  nombre: string;
  gradoId: number | null;
  grado: string | null;
  licencia: string | null;
  descuento: string;
  comboId: number | null;
}
export interface CorreoVenta {
  id: number;
  destinatario: string;
  estado: 'PENDIENTE' | 'ENVIADO' | 'FALLIDO';
  intentos: number;
  creadoEn: string;
  enviadoEn: string | null;
}
export interface Empresa {
  nombre: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  sitioLicencias: string | null;
  pie: string | null;
}
export interface Alumno {
  id: number;
  nombres: string;
  apellidos: string;
  nombre: string;
  activo: boolean;
  colegioId: number | null;
  colegio: string | null;
  gradoId: number | null;
  grado: string | null;
  encargados: {
    personaId: number;
    nombre: string;
    nit: string;
    telefono: string | null;
    correo: string | null;
    parentesco: string;
  }[];
}
export interface AlumnoDetalle extends Alumno {
  compras: {
    ventaId: number;
    codigo: string;
    fecha: string;
    estadoPago: string;
    grado: string | null;
    licencia: string | null;
    colegio: string;
    total: string;
  }[];
}

export interface FilaVenta {
  id: number;
  codigo: string;
  fecha: string;
  colegio: string;
  cliente: string;
  nit: string;
  alumno: string | null;
  total: string;
  recargo: string;
  estadoPago: string;
  estadoEntrega: string;
  usuario: string;
}

export const ESTADO_LINEA: Record<EstadoLinea, { texto: string; clase: string }> = {
  ENTREGADO: { texto: 'Entregado', clase: 'badge-ok' },
  RESERVADO: { texto: 'Reservado (recoge después)', clase: 'badge-warn' },
  PENDIENTE_TRASLADO: { texto: 'Pendiente de traslado', clase: 'badge-warn' },
  EN_TRANSITO: { texto: 'En tránsito', clase: 'badge-warn' },
  PENDIENTE_PROVEEDOR: { texto: 'Pendiente de proveedor', clase: 'badge-warn' },
  EN_PEDIDO: { texto: 'En pedido a proveedor', clase: 'badge-warn' },
  ANULADO: { texto: 'Anulado', clase: 'badge-off' },
};
export const ESTADO_TURNO: Record<EstadoTurno, { texto: string; clase: string }> = {
  ABIERTO: { texto: 'Abierto', clase: 'badge-ok' },
  EN_CIERRE: { texto: 'En cierre', clase: 'badge-warn' },
  CERRADO: { texto: 'Cerrado (por validar)', clase: 'badge-warn' },
  VALIDADO: { texto: 'Validado', clase: 'badge-ok' },
  OBSERVADO: { texto: 'Observado', clase: 'badge-off' },
};

/** Cliente HTTP de turnos y ventas. Guarda el turno activo para mostrarlo en la barra superior. */
@Injectable({ providedIn: 'root' })
export class VentasApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  readonly turno = signal<TurnoActual | null>(null);

  // Turnos
  denominaciones() {
    return this.http.get<Denominacion[]>(`${this.api}/denominaciones`);
  }
  cajasDisponibles(colegioId?: number | null) {
    let params = new HttpParams();
    if (colegioId) params = params.set('colegioId', colegioId);
    return this.http.get<CajaDisponible[]>(`${this.api}/cajas/disponibles`, { params });
  }
  turnoActual() {
    return this.http
      .get<{ turno: TurnoActual | null }>(`${this.api}/turnos/actual`)
      .pipe(tap((r) => this.turno.set(r.turno)));
  }
  turnos(f: { estado?: string; colegioId?: number | null; page?: number; limit?: number }) {
    let params = new HttpParams().set('page', f.page ?? 1).set('limit', f.limit ?? 50);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.colegioId) params = params.set('colegioId', f.colegioId);
    return this.http.get<Paginated<FilaTurno>>(`${this.api}/turnos`, { params });
  }
  abrirTurno(dto: { cajaId: number; conteo: Conteo[]; observacion?: string }) {
    return this.http.post<TurnoActual>(`${this.api}/turnos`, dto);
  }
  iniciarCierre(id: number) {
    return this.http.post<{ estado: string }>(`${this.api}/turnos/${id}/iniciar-cierre`, {});
  }
  cancelarCierre(id: number) {
    return this.http.post<{ estado: string }>(`${this.api}/turnos/${id}/cancelar-cierre`, {});
  }
  cerrar(id: number, dto: { conteo?: Conteo[]; observacion?: string }) {
    return this.http.post<ResultadoCierre>(`${this.api}/turnos/${id}/cerrar`, dto);
  }
  validar(id: number, dto: { resultado: 'VALIDADO' | 'OBSERVADO'; observacion?: string }) {
    return this.http.post<{ estado: string }>(`${this.api}/turnos/${id}/validar`, dto);
  }
  movimientoCaja(id: number, dto: { tipo: 'RETIRO' | 'INGRESO'; monto: string; motivo: string }) {
    return this.http.post<{ id: number }>(`${this.api}/turnos/${id}/movimientos`, dto);
  }
  acta(id: number) {
    return this.http.get<Acta>(`${this.api}/turnos/${id}/acta`);
  }

  /** Métodos de pago activos con su recargo vigente. */
  metodosPago() {
    return this.http.get<(Metodo & { activo: boolean })[]>(`${this.api}/metodos-pago`);
  }
  /** Existencias del colegio (el cajero solo ve el suyo). */
  existencias(colegioId: number) {
    return this.http.get<{ libroId: number; disponible: number }[]>(`${this.api}/inventario`, {
      params: new HttpParams().set('colegioId', colegioId),
    });
  }

  // Ventas
  cotizar(dto: VentaInput) {
    return this.http.post<Cotizacion>(`${this.api}/ventas/cotizar`, dto);
  }
  crearVenta(dto: VentaInput) {
    return this.http.post<Venta>(`${this.api}/ventas`, dto);
  }
  venta(id: number) {
    return this.http.get<Venta>(`${this.api}/ventas/${id}`);
  }
  ventas(f: {
    q?: string;
    estadoPago?: string;
    pendientesEntrega?: boolean;
    desde?: string;
    hasta?: string;
    turnoId?: number;
    clienteId?: number;
    page?: number;
    limit?: number;
  }) {
    let params = new HttpParams().set('page', f.page ?? 1).set('limit', f.limit ?? 30);
    if (f.clienteId) params = params.set('clienteId', f.clienteId);
    if (f.q) params = params.set('q', f.q);
    if (f.estadoPago) params = params.set('estadoPago', f.estadoPago);
    if (f.pendientesEntrega) params = params.set('pendientesEntrega', 'true');
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.turnoId) params = params.set('turnoId', f.turnoId);
    return this.http.get<Paginated<FilaVenta>>(`${this.api}/ventas`, { params });
  }
  entregar(id: number, lineas: { detalleId: number; cantidad: number }[]) {
    return this.http.post<Venta>(`${this.api}/ventas/${id}/entregas`, { lineas });
  }
  comprobante(id: number) {
    return this.http.get<{ venta: Venta; empresa: Empresa }>(
      `${this.api}/ventas/${id}/comprobante`,
    );
  }
  enviarComprobante(id: number, dto: { correo?: string; guardarEnCliente?: boolean }) {
    return this.http.post<Venta>(`${this.api}/ventas/${id}/comprobante/correo`, dto);
  }
  editarLicencia(id: number, ventaAlumnoId: number, licencia: string | null) {
    return this.http.patch<Venta>(`${this.api}/ventas/${id}/alumnos/${ventaAlumnoId}/licencia`, {
      licencia,
    });
  }

  // Alumnos
  alumnosDe(personaId: number) {
    return this.http.get<Alumno[]>(`${this.api}/personas/${personaId}/alumnos`);
  }
  alumnos(f: { q?: string; colegioId?: number | null; page?: number; limit?: number }) {
    let params = new HttpParams().set('page', f.page ?? 1).set('limit', f.limit ?? 30);
    if (f.q) params = params.set('q', f.q);
    if (f.colegioId) params = params.set('colegioId', f.colegioId);
    return this.http.get<Paginated<Alumno>>(`${this.api}/alumnos`, { params });
  }
  alumno(id: number) {
    return this.http.get<AlumnoDetalle>(`${this.api}/alumnos/${id}`);
  }
  editarAlumno(
    id: number,
    dto: Partial<{
      nombres: string;
      apellidos: string;
      gradoId: number;
      colegioId: number;
      activo: boolean;
    }>,
  ) {
    return this.http.patch<AlumnoDetalle>(`${this.api}/alumnos/${id}`, dto);
  }
  vincularEncargado(id: number, personaId: number, parentesco: string) {
    return this.http.post<AlumnoDetalle>(`${this.api}/alumnos/${id}/encargados`, {
      personaId,
      parentesco,
    });
  }
  desvincularEncargado(id: number, personaId: number) {
    return this.http.delete<AlumnoDetalle>(`${this.api}/alumnos/${id}/encargados/${personaId}`);
  }

  anular(id: number, dto: { motivo: string; devuelveLibros: boolean }) {
    return this.http.post<{
      reembolsoEfectivo: string;
      reembolsoOtrosMedios: string;
      reasignadosAPendientes: number;
      venta: Venta;
    }>(`${this.api}/ventas/${id}/anular`, dto);
  }
}
