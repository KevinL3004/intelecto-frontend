import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { ROL_LABEL } from '../core/auth/auth.models';
import { ThemeService } from '../core/theme/theme.service';
import { MENU } from './menu';
import { VentasApi } from '../core/ventas/ventas.api';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex min-h-screen">
      <!-- Barra lateral -->
      <aside
        class="print:hidden fixed inset-y-0 left-0 z-30 w-60 -translate-x-full border-r border-zinc-200 bg-white p-4 transition-transform
               dark:border-zinc-800 dark:bg-zinc-950 md:static md:translate-x-0"
        [class.translate-x-0]="menuAbierto()"
      >
        <div class="mb-6 px-2">
          <p class="text-sm font-semibold tracking-wide">INTELECTO</p>
          <p class="muted text-xs">Sistema de ventas</p>
        </div>
        <nav class="space-y-5">
          @for (g of menu(); track g.titulo) {
            <div>
              <p class="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {{ g.titulo }}
              </p>
              @for (i of g.items; track i.ruta) {
                <a
                  [routerLink]="i.ruta"
                  [queryParams]="i.query ?? {}"
                  routerLinkActive="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  [routerLinkActiveOptions]="i.exacto ? exacto : activo"
                  (click)="menuAbierto.set(false)"
                  class="block rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >{{ i.label }}</a
                >
              }
            </div>
          }
        </nav>
      </aside>
      @if (menuAbierto()) {
        <div
          class="fixed inset-0 z-20 bg-black/30 md:hidden"
          (click)="menuAbierto.set(false)"
        ></div>
      }

      <!-- Contenido -->
      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="print:hidden flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800"
        >
          <button
            class="btn-ghost btn-sm md:hidden"
            (click)="menuAbierto.set(true)"
            aria-label="Menú"
          >
            ☰
          </button>
          <div class="hidden md:block">
            @if (ventas.turno(); as t) {
              <a routerLink="/pos" class="badge-ok" title="Turno de caja activo">
                Caja {{ t.cajaNumero }} · {{ t.colegio
                }}{{ t.estado === 'EN_CIERRE' ? ' · en cierre' : '' }}
              </a>
            }
          </div>
          <div class="flex items-center gap-2">
            <button
              class="btn-ghost btn-sm"
              (click)="theme.alternar()"
              [attr.aria-label]="'Tema: ' + temaLabel()"
            >
              {{ temaLabel() }}
            </button>
            <div class="hidden text-right sm:block">
              <p class="text-sm leading-tight">{{ auth.usuario()?.nombre }}</p>
              <p class="muted text-xs leading-tight">{{ rolLabel() }}</p>
            </div>
            <button class="btn-secondary btn-sm" (click)="auth.logout()">Salir</button>
          </div>
        </header>
        <main class="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 print:max-w-none print:p-0">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly menuAbierto = signal(false);
  readonly ventas = inject(VentasApi);
  /** "/ventas" y "/ventas?pendientes=1" se resaltan por separado. */
  readonly activo = {
    paths: 'subset',
    queryParams: 'exact',
    fragment: 'ignored',
    matrixParams: 'ignored',
  } as const;
  readonly exacto = { ...this.activo, paths: 'exact' } as const;

  constructor() {
    // Muestra la caja activa en la barra superior.
    if (this.auth.autenticado()) this.ventas.turnoActual().subscribe({ error: () => undefined });
  }

  readonly menu = computed(() => {
    const rol = this.auth.usuario()?.rol;
    return MENU.map((g) => ({
      ...g,
      items: g.items.filter((i) => rol && i.roles.includes(rol)),
    })).filter((g) => g.items.length);
  });
  readonly rolLabel = computed(() => {
    const r = this.auth.usuario()?.rol;
    return r ? ROL_LABEL[r] : '';
  });
  readonly temaLabel = computed(
    () => ({ light: '☀ Claro', dark: '☾ Oscuro', system: '◐ Sistema' })[this.theme.tema()],
  );
}
