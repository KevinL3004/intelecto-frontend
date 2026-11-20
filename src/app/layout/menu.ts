import { Rol } from '../core/auth/auth.models';

export interface MenuItem {
  label: string;
  ruta: string;
  roles: Rol[];
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
    titulo: 'Administración',
    items: [
      { label: 'Colegios', ruta: '/admin/colegios', roles: ['ADMIN', 'CONTADOR'] },
      {
        label: 'Métodos de pago',
        ruta: '/admin/metodos-pago',
        roles: ['ADMIN', 'CONTADOR', 'CAJERO'],
      },
    ],
  },
];
