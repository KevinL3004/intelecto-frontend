import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  template: `
    <h1 class="page-title">Hola, {{ auth.usuario()?.nombre }}</h1>
    <p class="muted mb-6">Bienvenido al sistema de ventas de Intelecto.</p>
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="card">
        <p class="muted">Ventas de hoy</p>
        <p class="money text-2xl font-semibold">—</p>
      </div>
      <div class="card">
        <p class="muted">Pendientes de entrega</p>
        <p class="text-2xl font-semibold">—</p>
      </div>
      <div class="card">
        <p class="muted">Cajas abiertas</p>
        <p class="text-2xl font-semibold">—</p>
      </div>
    </div>
  `,
})
export class InicioComponent {
  readonly auth = inject(AuthService);
}
