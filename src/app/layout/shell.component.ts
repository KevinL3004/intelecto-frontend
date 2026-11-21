import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ROL_LABEL } from '../core/auth/auth.models';
import { ThemeService } from '../core/theme/theme.service';
import { MENU, MenuGrupo, MenuItem } from './menu';
import { AvisosService } from '../core/ui/avisos.service';
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
        <nav class="space-y-1" aria-label="Menú principal">
          @for (g of menu(); track g.titulo) {
            @if (g.items.length === 1) {
              <!-- Grupo de una sola opción: enlace directo, sin desplegar. -->
              @let i = g.items[0];
              <a
                [routerLink]="i.ruta"
                [queryParams]="i.query ?? {}"
                routerLinkActive="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                [routerLinkActiveOptions]="i.exacto ? exacto : activo"
                (click)="menuAbierto.set(false)"
                class="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {{ i.label }}
                @if (aviso(i); as n) {
                  <span class="aviso" [title]="n + ' ' + (i.avisoTexto ?? '')">{{ n }}</span>
                }
              </a>
            } @else {
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                [attr.aria-expanded]="abierto() === g.titulo"
                [attr.aria-controls]="'menu-' + $index"
                (click)="alternar(g.titulo)"
              >
                <span class="flex items-center gap-2">
                  <span
                    class="inline-block w-3 text-xs text-zinc-400 transition-transform"
                    [class.rotate-90]="abierto() === g.titulo"
                    aria-hidden="true"
                    >▸</span
                  >
                  {{ g.titulo }}
                </span>
                @if (abierto() !== g.titulo && avisosGrupo(g); as n) {
                  <span class="aviso" [title]="n + ' pendiente(s)'">{{ n }}</span>
                }
              </button>
              @if (abierto() === g.titulo) {
                <div
                  [id]="'menu-' + $index"
                  class="mb-1 ml-5 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800"
                >
                  @for (i of g.items; track i.label) {
                    <a
                      [routerLink]="i.ruta"
                      [queryParams]="i.query ?? {}"
                      routerLinkActive="bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      [routerLinkActiveOptions]="i.exacto ? exacto : activo"
                      (click)="menuAbierto.set(false)"
                      class="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      {{ i.label }}
                      @if (aviso(i); as n) {
                        <span class="aviso" [title]="n + ' ' + (i.avisoTexto ?? '')">{{ n }}</span>
                      }
                    </a>
                  }
                </div>
              }
            }
          }
        </nav>
      </aside>
      @if (menuAbierto()) {
        <div
          class="fixed inset-0 z-20 bg-black/30 md:hidden print:hidden"
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

  private readonly router = inject(Router);
  private readonly avisosSrv = inject(AvisosService);
  /** Grupo del menú desplegado (uno a la vez); se abre solo el de la pantalla actual. */
  readonly abierto = signal<string | null>(null);

  constructor() {
    // Muestra la caja activa en la barra superior.
    if (this.auth.autenticado()) this.ventas.turnoActual().subscribe({ error: () => undefined });
    this.avisosSrv.iniciar();
    inject(DestroyRef).onDestroy(() => this.avisosSrv.detener());
    this.abrirGrupoActual();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.abrirGrupoActual();
        this.avisosSrv.refrescar();
      });
  }

  alternar(titulo: string) {
    this.abierto.update((a) => (a === titulo ? null : titulo));
  }

  private abrirGrupoActual() {
    const g = this.menu().find((x) =>
      x.items.some((i) =>
        this.router.isActive(
          this.router.createUrlTree([i.ruta], { queryParams: i.query ?? {} }),
          i.exacto ? this.exacto : this.activo,
        ),
      ),
    );
    if (g && g.items.length > 1) this.abierto.set(g.titulo);
  }

  aviso(i: MenuItem): number {
    const a = this.avisosSrv.avisos();
    return (a && i.aviso?.(a)) || 0;
  }
  avisosGrupo(g: MenuGrupo): number {
    return g.items.reduce((t, i) => t + this.aviso(i), 0);
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
