import { Routes } from '@angular/router';
import { authGuard, passwordGuard, roleGuard } from './core/auth/auth.guards';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'cambiar-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/cambiar-password.component').then((m) => m.CambiarPasswordComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard, passwordGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./features/inicio/inicio.component').then((m) => m.InicioComponent),
      },
      {
        path: 'personas',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/admin/personas/personas.component').then((m) => m.PersonasComponent),
      },
      {
        path: 'admin/usuarios',
        canActivate: [roleGuard('ADMIN', 'CONTADOR')],
        loadComponent: () =>
          import('./features/admin/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
      {
        path: 'admin/cajas',
        canActivate: [roleGuard('ADMIN', 'CONTADOR')],
        loadComponent: () =>
          import('./features/admin/cajas/cajas.component').then((m) => m.CajasComponent),
      },
      {
        path: 'admin/colegios',
        canActivate: [roleGuard('ADMIN', 'CONTADOR')],
        loadComponent: () =>
          import('./features/admin/colegios/colegios.component').then((m) => m.ColegiosComponent),
      },
      {
        path: 'admin/metodos-pago',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/admin/metodos-pago/metodos-pago.component').then(
            (m) => m.MetodosPagoComponent,
          ),
      },
      {
        path: 'pos',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () => import('./features/pos/pos.component').then((m) => m.PosComponent),
      },
      {
        path: 'pos/cierre',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/pos/cierre.component').then((m) => m.CierreComponent),
      },
      {
        path: 'ventas',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/ventas/ventas.component').then((m) => m.VentasComponent),
      },
      {
        path: 'ventas/:id',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/ventas/venta-detalle.component').then((m) => m.VentaDetalleComponent),
      },
      {
        path: 'turnos',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/turnos/turnos.component').then((m) => m.TurnosComponent),
      },
      {
        path: 'turnos/:id',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/turnos/turno-detalle.component').then((m) => m.TurnoDetalleComponent),
      },
      {
        path: 'inventario/traslados',
        canActivate: [roleGuard('ADMIN', 'CONTADOR')],
        loadComponent: () =>
          import('./features/inventario/traslados.component').then((m) => m.TrasladosComponent),
      },
      {
        path: 'inventario/pedidos',
        canActivate: [roleGuard('ADMIN', 'CONTADOR')],
        loadComponent: () =>
          import('./features/inventario/pedidos.component').then((m) => m.PedidosComponent),
      },
      {
        path: 'inventario/proveedores',
        canActivate: [roleGuard('ADMIN', 'CONTADOR')],
        loadComponent: () =>
          import('./features/inventario/proveedores.component').then((m) => m.ProveedoresComponent),
      },
      {
        path: 'catalogo/libros',
        canActivate: [roleGuard('ADMIN', 'CONTADOR')],
        loadComponent: () =>
          import('./features/catalogo/libros/libros.component').then((m) => m.LibrosComponent),
      },
      {
        path: 'catalogo/precios',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/catalogo/precios/precios.component').then((m) => m.PreciosComponent),
      },
      {
        path: 'catalogo/combos',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/catalogo/combos/combos.component').then((m) => m.CombosComponent),
      },
      {
        path: 'inventario',
        canActivate: [roleGuard('ADMIN', 'CONTADOR', 'CAJERO')],
        loadComponent: () =>
          import('./features/inventario/inventario.component').then((m) => m.InventarioComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
