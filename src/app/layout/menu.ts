import { Rol } from '../core/auth/auth.models';
import { Avisos } from '../core/ui/avisos.service';

export interface MenuItem {
  label: string;
  ruta: string;
  /** Parámetros de consulta opcionales, p. ej. { pendientes: '1' }. */
  query?: Record<string, string>;
  /** Resaltar solo en la ruta exacta (p. ej. /pos no debe resaltarse en /pos/cierre). */
  exacto?: boolean;
  roles: Rol[];
  /** Contador de trabajo pendiente que se muestra junto a la opción. */
  aviso?: (a: Avisos) => number | undefined;
  /** Texto del aviso (tooltip y lector de pantalla). */
  avisoTexto?: string;
}

export interface MenuGrupo {
  titulo: string;
  items: MenuItem[];
}

/** Agregar aquí cada módulo nuevo; el menú se filtra por rol automáticamente. */
export const MENU: MenuGrupo[] = [
  {
    titulo: 'General',
    items: [{ label: 'Inicio', ruta: '/inicio', roles: ['ADMIN', 'CONTADOR', 'CAJERO'] }],
  },
  {
    titulo: 'Caja',
    items: [
      {
        label: 'Punto de venta',
        ruta: '/pos',
        exacto: true,
        roles: ['ADMIN', 'CONTADOR', 'CAJERO'],
      },
      { label: 'Cierre de turno', ruta: '/pos/cierre', roles: ['ADMIN', 'CONTADOR', 'CAJERO'] },
    ],
  },
  {
    titulo: 'Ventas',
    items: [
      { label: 'Ventas', ruta: '/ventas', roles: ['ADMIN', 'CONTADOR', 'CAJERO'] },
      {
        label: 'Entregas pendientes',
        ruta: '/ventas',
        query: { pendientes: '1' },
        roles: ['ADMIN', 'CONTADOR', 'CAJERO'],
        aviso: (a) => a.entregasPendientes,
        avisoTexto: 'ventas con libros por entregar',
      },
      {
        label: 'Turnos y cierres',
        ruta: '/turnos',
        roles: ['ADMIN', 'CONTADOR', 'CAJERO'],
        aviso: (a) => a.turnosPorValidar,
        avisoTexto: 'cierres por validar',
      },
    ],
  },
  {
    titulo: 'Reportes',
    items: [{ label: 'Reportes', ruta: '/reportes', roles: ['ADMIN', 'CONTADOR', 'CAJERO'] }],
  },
  {
    titulo: 'Catálogo',
    items: [
      { label: 'Libros', ruta: '/catalogo/libros', roles: ['ADMIN', 'CONTADOR'] },
      { label: 'Precios', ruta: '/catalogo/precios', roles: ['ADMIN', 'CONTADOR', 'CAJERO'] },
      { label: 'Combos', ruta: '/catalogo/combos', roles: ['ADMIN', 'CONTADOR', 'CAJERO'] },
    ],
  },
  {
    titulo: 'Inventario',
    items: [
      {
        label: 'Existencias',
        ruta: '/inventario',
        exacto: true,
        roles: ['ADMIN', 'CONTADOR', 'CAJERO'],
      },
      {
        label: 'Traslados',
        ruta: '/inventario/traslados',
        roles: ['ADMIN', 'CONTADOR'],
        aviso: (a) => (a.trasladosPorRecibir ?? 0) + (a.trasladosPorDespachar ?? 0),
        avisoTexto: 'traslados por despachar o recibir',
      },
      {
        label: 'Pedidos a proveedor',
        ruta: '/inventario/pedidos',
        roles: ['ADMIN', 'CONTADOR'],
        aviso: (a) => a.unidadesPorPedir,
        avisoTexto: 'libros vendidos por pedir al proveedor',
      },
    ],
  },
  {
    titulo: 'Clientes',
    items: [
      { label: 'Personas y clientes', ruta: '/personas', roles: ['ADMIN', 'CONTADOR', 'CAJERO'] },
      { label: 'Alumnos', ruta: '/alumnos', roles: ['ADMIN', 'CONTADOR'] },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { label: 'Usuarios', ruta: '/admin/usuarios', roles: ['ADMIN', 'CONTADOR'] },
      { label: 'Colegios', ruta: '/admin/colegios', roles: ['ADMIN', 'CONTADOR'] },
      { label: 'Cajas', ruta: '/admin/cajas', roles: ['ADMIN', 'CONTADOR'] },
      {
        label: 'Métodos de pago',
        ruta: '/admin/metodos-pago',
        roles: ['ADMIN', 'CONTADOR', 'CAJERO'],
      },
      { label: 'Configuración', ruta: '/admin/configuracion', roles: ['ADMIN'] },
    ],
  },
];
