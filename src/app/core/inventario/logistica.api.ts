import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Paginated } from '../http/api-error';

export interface Sugerencia {
  destinoId: number;
  destino: string;
  libroId: number;
  titulo: string;
  isbn: string | null;
  pendientes: number;
  diasEspera: number;
  origenes: { colegioId: number; colegio: string; excedente: number }[];
}
export type EstadoTraslado = 'BORRADOR' | 'EN_TRANSITO' | 'RECIBIDO' | 'CANCELADO';
export interface FilaTraslado {
  id: number;
  estado: EstadoTraslado;
  origen: string;
  destino: string;
  observacion: string | null;
  creadoEn: string;
  despachadoEn: string | null;
  recibidoEn: string | null;
  unidades: number;
  usuario: string;
}
export interface Traslado extends FilaTraslado {
  origenId: number;
  destinoId: number;
  recibidoPor: string | null;
  items: {
    libroId: number;
    titulo: string;
    isbn: string | null;
    cantidad: number;
    recibido: number;
  }[];
}
export interface Proveedor {
  id: number;
  nombre: string;
  nit: string | null;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
}
export interface PorPedir {
  colegioId: number;
  colegio: string;
  libroId: number;
  titulo: string;
  isbn: string | null;
  editorial: string | null;
  pendientes: number;
  diasEspera: number;
}
export type EstadoPedido = 'SOLICITADO' | 'PARCIAL' | 'RECIBIDO' | 'CANCELADO';
export interface FilaPedido {
  id: number;
  estado: EstadoPedido;
  proveedor: string;
  colegio: string;
  observacion: string | null;
  creadoEn: string;
  usuario: string;
  solicitado: number;
  recibido: number;
}
export interface Pedido extends FilaPedido {
  proveedorId: number;
  colegioDestinoId: number;
  items: {
    libroId: number;
    titulo: string;
    isbn: string | null;
    solicitado: number;
    recibido: number;
  }[];
}
export type Item = { libroId: number; cantidad: number };

export const ESTADO_TRASLADO: Record<EstadoTraslado, { texto: string; clase: string }> = {
  BORRADOR: { texto: 'Borrador', clase: 'badge-off' },
  EN_TRANSITO: { texto: 'En tránsito', clase: 'badge-warn' },
  RECIBIDO: { texto: 'Recibido', clase: 'badge-ok' },
  CANCELADO: { texto: 'Cancelado', clase: 'badge-off' },
};
export const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; clase: string }> = {
  SOLICITADO: { texto: 'Solicitado', clase: 'badge-warn' },
  PARCIAL: { texto: 'Recibido parcial', clase: 'badge-warn' },
  RECIBIDO: { texto: 'Recibido', clase: 'badge-ok' },
  CANCELADO: { texto: 'Cancelado', clase: 'badge-off' },
};

/** Traslados entre colegios, proveedores y pedidos a proveedor. */
@Injectable({ providedIn: 'root' })
export class LogisticaApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  sugerencias() {
    return this.http.get<Sugerencia[]>(`${this.api}/inventario/sugerencias-traslado`);
  }
  traslados(estado = '', page = 1, limit = 50) {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (estado) params = params.set('estado', estado);
    return this.http.get<Paginated<FilaTraslado>>(`${this.api}/traslados`, { params });
  }
  traslado(id: number) {
    return this.http.get<Traslado>(`${this.api}/traslados/${id}`);
  }
  crearTraslado(dto: {
    origenId: number;
    destinoId: number;
    observacion?: string;
    items: Item[];
    despachar?: boolean;
  }) {
    return this.http.post<Traslado>(`${this.api}/traslados`, dto);
  }
  despachar(id: number) {
    return this.http.post<Traslado>(`${this.api}/traslados/${id}/despachar`, {});
  }
  recibir(
    id: number,
    dto: { items: { libroId: number; recibido: number }[]; observacion?: string },
  ) {
    return this.http.post<{
      reservadosParaPendientes: number;
      incidencia: boolean;
      traslado: Traslado;
    }>(`${this.api}/traslados/${id}/recibir`, dto);
  }
  cancelarTraslado(id: number) {
    return this.http.post<Traslado>(`${this.api}/traslados/${id}/cancelar`, {});
  }

  proveedores(q = '', soloActivos = false) {
    let params = new HttpParams().set('q', q).set('limit', 200);
    if (soloActivos) params = params.set('activo', 'true');
    return this.http.get<Paginated<Proveedor>>(`${this.api}/proveedores`, { params });
  }
  crearProveedor(dto: Partial<Proveedor>) {
    return this.http.post<Proveedor>(`${this.api}/proveedores`, dto);
  }
  editarProveedor(id: number, dto: Partial<Proveedor>) {
    return this.http.patch<Proveedor>(`${this.api}/proveedores/${id}`, dto);
  }
  eliminarProveedor(id: number) {
    return this.http.delete<{ resultado: 'ELIMINADO' | 'DESACTIVADO' }>(
      `${this.api}/proveedores/${id}`,
    );
  }

  porPedir() {
    return this.http.get<PorPedir[]>(`${this.api}/inventario/por-pedir`);
  }
  pedidos(estado = '', page = 1, limit = 50) {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (estado) params = params.set('estado', estado);
    return this.http.get<Paginated<FilaPedido>>(`${this.api}/pedidos-proveedor`, { params });
  }
  pedido(id: number) {
    return this.http.get<Pedido>(`${this.api}/pedidos-proveedor/${id}`);
  }
  crearPedido(dto: {
    proveedorId: number;
    colegioDestinoId: number;
    observacion?: string;
    items: { libroId: number; solicitado: number }[];
  }) {
    return this.http.post<Pedido>(`${this.api}/pedidos-proveedor`, dto);
  }
  recepcion(id: number, dto: { items: Item[]; referencia?: string }) {
    return this.http.post<{ reservadosParaPendientes: number; pedido: Pedido }>(
      `${this.api}/pedidos-proveedor/${id}/recepciones`,
      dto,
    );
  }
  cancelarPedido(id: number) {
    return this.http.post<Pedido>(`${this.api}/pedidos-proveedor/${id}/cancelar`, {});
  }
}
