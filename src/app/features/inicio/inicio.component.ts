import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Dashboard, ReportesApi } from '../../core/reportes/reportes.api';
import { ESTADO_LINEA, EstadoLinea, Metodo, VentasApi } from '../../core/ventas/ventas.api';
import { AvisosService } from '../../core/ui/avisos.service';
import { QuetzalPipe } from '../../shared/quetzal.pipe';

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Inicio. Admin y Contador ven el tablero del día (R-13); el cajero, accesos rápidos. */
@Component({
  selector: 'app-inicio',
  imports: [DatePipe, RouterLink, QuetzalPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h1 class="page-title">Hola, {{ auth.usuario()?.nombre }}</h1>
    @if (!supervisor) {
      <p class="muted mb-6">¿Qué desea hacer?</p>
      <div class="grid gap-4 sm:grid-cols-3">
        <a class="card hover:border-accent-500" routerLink="/pos">
          <p class="font-medium">Punto de venta</p>
          <p class="muted">Abrir turno, vender y cobrar</p>
        </a>
        <a
          class="card hover:border-accent-500"
          routerLink="/ventas"
          [queryParams]="{ pendientes: '1' }"
        >
          <p class="flex items-center justify-between font-medium">
            Entregas pendientes
            @if (avisos()?.entregasPendientes; as n) {
              <span class="aviso">{{ n }}</span>
            }
          </p>
          <p class="muted">
            {{
              avisos()?.entregasPendientes
                ? avisos()!.entregasPendientes + ' venta(s) de su colegio con libros por entregar'
                : 'Libros que el cliente recoge'
            }}
          </p>
        </a>
        <a class="card hover:border-accent-500" routerLink="/ventas">
          <p class="font-medium">Mis ventas</p>
          <p class="muted">Consultar y reimprimir comprobantes</p>
        </a>
      </div>
      @if (metodos().length) {
        <div class="card mt-4 max-w-md text-sm">
          <p class="mb-1 font-medium">Recargos vigentes</p>
          @for (m of metodos(); track m.id) {
            <div class="flex justify-between">
              <span>{{ m.nombre }}</span>
              <span
                [class]="
                  m.recargoPct !== '0.00'
                    ? 'font-semibold text-amber-700 dark:text-amber-400'
                    : 'muted'
                "
              >
                {{ m.recargoPct !== '0.00' ? '+' + m.recargoPct + ' %' : 'sin recargo' }}
              </span>
            </div>
          }
        </div>
      }
    } @else if (d()) {
      @let dash = d()!;
      <p class="muted mb-6">Resumen de hoy</p>
      <div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card">
          <p class="muted">Ventas de hoy</p>
          <p class="money text-2xl font-semibold">{{ dash.hoy.total | quetzal }}</p>
          <p class="muted text-xs">
            {{ dash.hoy.ventas }} venta(s) · recargos {{ dash.hoy.recargo | quetzal }}
          </p>
        </div>
        <a
          class="card hover:border-accent-500"
          routerLink="/reportes"
          [queryParams]="{ tipo: 'pendientes' }"
        >
          <p class="muted">Pendientes de entrega</p>
          <p class="text-2xl font-semibold tabular-nums">{{ totalPendientes() }}</p>
          <p class="muted text-xs">libros</p>
        </a>
        <div class="card">
          <p class="muted">Cajas abiertas</p>
          <p class="text-2xl font-semibold tabular-nums">{{ dash.cajasAbiertas.length }}</p>
        </div>
        <a class="card hover:border-accent-500" routerLink="/turnos">
          <p class="muted">Cierres por validar</p>
          <p class="text-2xl font-semibold tabular-nums">{{ dash.turnosPorValidar }}</p>
        </a>
      </div>

      @if (trabajo().length) {
        <div class="mb-4 flex flex-wrap gap-2" role="status" aria-label="Trabajo pendiente">
          @for (t of trabajo(); track t.texto) {
            <a
              class="flex items-center gap-2 rounded-lg border border-amber-400 px-3 py-2 text-sm hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-950/30"
              [routerLink]="t.ruta"
              [queryParams]="t.query ?? {}"
            >
              <span class="aviso ml-0">{{ t.n }}</span> {{ t.texto }}
            </a>
          }
        </div>
      }

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="card lg:col-span-2">
          <p class="mb-3 font-medium">Ventas de los últimos 7 días</p>
          <div class="flex h-40 items-end gap-2" role="img" [attr.aria-label]="resumenGrafica()">
            @for (b of barras(); track b.dia) {
              <div class="group relative flex h-full flex-1 flex-col items-center justify-end">
                <div
                  class="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm group-hover:block dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {{ b.fecha | date: 'dd/MM' }} · <span class="money">{{ b.total | quetzal }}</span>
                </div>
                <div
                  class="w-full max-w-10 rounded-t bg-accent-500 transition-opacity group-hover:opacity-80"
                  [style.height.%]="b.alto"
                  [style.min-height.px]="b.valor > 0 ? 2 : 0"
                ></div>
              </div>
            }
          </div>
          <div class="mt-1 flex gap-2 border-t border-zinc-200 pt-1 dark:border-zinc-800">
            @for (b of barras(); track b.dia) {
              <span class="muted flex-1 text-center text-xs">{{ b.etiqueta }}</span>
            }
          </div>
        </div>
        <div class="card">
          <p class="mb-2 font-medium">Cobrado hoy por método</p>
          @for (m of dash.porMetodo; track m.nombre) {
            <div class="flex justify-between py-1 text-sm">
              <span
                >{{ m.nombre }} <span class="muted">({{ m.pagos }})</span></span
              >
              <span class="money">{{ m.total | quetzal }}</span>
            </div>
          }
          @if (dash.pendientes.length) {
            <p class="mb-1 mt-4 font-medium">Pendientes por estado</p>
            @for (p of dash.pendientes; track p.estado) {
              <div class="flex justify-between py-0.5 text-sm">
                <span>{{ estado(p.estado) }}</span
                ><span class="tabular-nums">{{ p.unidades }}</span>
              </div>
            }
          }
        </div>
      </div>

      @if (dash.cajasAbiertas.length) {
        <div class="card mt-4 overflow-x-auto p-0">
          <p class="px-3 pt-3 font-medium">Cajas abiertas</p>
          <table class="table">
            <thead>
              <tr>
                <th>Colegio</th>
                <th>Caja</th>
                <th>Cajero</th>
                <th>Desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of dash.cajasAbiertas; track c.id) {
                <tr>
                  <td>{{ c.colegio }}</td>
                  <td>{{ c.caja }}</td>
                  <td>{{ c.cajero }}</td>
                  <td>{{ c.abiertoEn | date: 'dd/MM HH:mm' }}</td>
                  <td class="text-right">
                    <a class="btn-ghost btn-sm" [routerLink]="['/turnos', c.id]">Ver acta</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else {
      <p class="muted">Cargando…</p>
    }
  `,
})
export class InicioComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ReportesApi);
  readonly supervisor = this.auth.tieneRol('ADMIN', 'CONTADOR');
  readonly d = signal<Dashboard | null>(null);
  private readonly ventasApi = inject(VentasApi);
  readonly avisos = inject(AvisosService).avisos;
  readonly metodos = signal<Metodo[]>([]);
  /** Trabajo pendiente para Admin/Contador, con acceso directo a donde se resuelve. */
  readonly trabajo = computed(() => {
    const a = this.avisos();
    if (!a) return [];
    const r = (
      n: number | undefined,
      texto: string,
      ruta: string,
      query?: Record<string, string>,
    ) => (n ? [{ n, texto, ruta, query }] : []);
    return [
      ...r(a.trasladosPorDespachar, 'traslado(s) por despachar', '/inventario/traslados'),
      ...r(a.trasladosPorRecibir, 'traslado(s) en camino por recibir', '/inventario/traslados'),
      ...r(a.unidadesPorTrasladar, 'libro(s) vendidos esperando traslado', '/inventario/traslados'),
      ...r(a.unidadesPorPedir, 'libro(s) vendidos por pedir al proveedor', '/inventario/pedidos'),
      ...r(a.correosFallidos, 'comprobante(s) por correo no enviados (7 días)', '/ventas'),
    ];
  });

  readonly totalPendientes = computed(() =>
    (this.d()?.pendientes ?? []).reduce((a, p) => a + p.unidades, 0),
  );
  readonly barras = computed(() => {
    const dias = this.d()?.ultimos7 ?? [];
    const max = Math.max(...dias.map((x) => Number(x.total)), 0);
    return dias.map((x) => {
      const fecha = new Date(x.dia + 'T12:00:00');
      return {
        dia: x.dia,
        fecha,
        total: x.total,
        valor: Number(x.total),
        alto: max ? (Number(x.total) / max) * 100 : 0,
        etiqueta: DIAS[fecha.getDay()],
      };
    });
  });
  readonly resumenGrafica = computed(
    () =>
      'Ventas por día: ' +
      this.barras()
        .map((b) => `${b.etiqueta} Q${b.total}`)
        .join(', '),
  );

  ngOnInit() {
    if (this.supervisor) this.api.dashboard().subscribe((d) => this.d.set(d));
    else
      this.ventasApi
        .metodosPago()
        .subscribe((ms) =>
          this.metodos.set(ms.map((m) => ({ ...m, recargoPct: Number(m.recargoPct).toFixed(2) }))),
        );
  }

  estado(e: string) {
    return ESTADO_LINEA[e as EstadoLinea]?.texto ?? e;
  }
}
