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
