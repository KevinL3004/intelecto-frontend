import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { mensajeError } from '../../core/http/api-error';
import { ToastService } from '../../core/ui/toast.service';
import { Analisis, ReportesApi } from '../../core/reportes/reportes.api';
import { ESTADO_LINEA, EstadoLinea } from '../../core/ventas/ventas.api';
import { Colegio, ColegiosService } from '../admin/colegios/colegios.service';
import { LineaPronosticoComponent } from '../../shared/graficas/linea-pronostico.component';
import { Barra, BarrasComponent } from '../../shared/graficas/barras.component';
import { qCompleto } from '../../shared/graficas/escala';
import { AbastecimientoComponent } from './abastecimiento.component';

const NIVEL = {
  CRITICO: { texto: 'Crítico', icono: '▲', color: 'var(--viz-critico)' },
  ALTO: { texto: 'Alto', icono: '●', color: 'var(--viz-serio)' },
  MEDIO: { texto: 'Atención', icono: '◆', color: 'var(--viz-aviso)' },
  INFO: { texto: 'Info', icono: 'ℹ', color: 'var(--viz-serie)' },
} as const;

/** Análisis para decisiones (Admin/Contador): alertas, indicadores, pronóstico y abastecimiento. */
@Component({
  selector: 'app-analisis',
  imports: [
    FormsModule,
    RouterLink,
    LineaPronosticoComponent,
    BarrasComponent,
    AbastecimientoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <span class="label">Período</span>
        <div class="flex gap-1" role="group" aria-label="Período">
          @for (d of periodos; track d) {
            <button
              class="btn-sm rounded-lg border px-3"
              [class]="
                dias() === d
                  ? 'border-accent-500 font-medium'
                  : 'border-zinc-300 dark:border-zinc-700'
              "
              [attr.aria-pressed]="dias() === d"
              (click)="dias.set(d); cargar()"
            >
              {{ d }} días
            </button>
          }
        </div>
      </div>
      <div>
        <label class="label" for="acol">Colegio</label>
        <select
          id="acol"
          class="input w-52"
          [ngModel]="colegioId()"
          (ngModelChange)="colegioId.set($event); cargar()"
        >
          <option [ngValue]="null">Todos los colegios</option>
          @for (c of colegios(); track c.id) {
            <option [ngValue]="c.id">{{ c.nombre }}</option>
          }
        </select>
      </div>
      @if (cargando()) {
        <span class="muted pb-2 text-sm">Actualizando…</span>
      }
    </div>

    @if (a(); as a) {
      <!-- Alertas -->
      @if (a.alertas.length) {
        <div class="mb-4 space-y-2" aria-label="Alertas">
          @for (x of a.alertas; track x.titulo) {
            <div class="card flex items-start gap-3 p-3">
              <span
                class="mt-0.5 text-lg leading-none"
                [style.color]="nivel(x.nivel).color"
                aria-hidden="true"
                >{{ nivel(x.nivel).icono }}</span
              >
              <div class="min-w-0 flex-1">
                <p class="text-sm">
                  <span class="muted mr-1 text-xs uppercase tracking-wide">{{
                    nivel(x.nivel).texto
                  }}</span>
                  <strong>{{ x.titulo }}</strong>
                </p>
                <p class="muted text-sm">{{ x.detalle }}</p>
              </div>
              @if (x.accion; as ac) {
                @if (ac === 'abastecimiento') {
                  <a
                    class="btn-secondary btn-sm whitespace-nowrap"
                    href="#abastecimiento"
                    (click)="ir($event, 'abastecimiento')"
                    >Ver sugerencias</a
                  >
                } @else if (ac === 'pendientes') {
                  <a
                    class="btn-secondary btn-sm whitespace-nowrap"
                    routerLink="/ventas"
                    [queryParams]="{ pendientes: '1' }"
                    >Ver pendientes</a
                  >
                } @else if (ac === 'cuadres') {
                  <a class="btn-secondary btn-sm whitespace-nowrap" routerLink="/turnos"
                    >Ver cierres</a
                  >
                }
              }
            </div>
          }
        </div>
      }

      <!-- Indicadores -->
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card">
          <p class="muted text-sm">Ingresos</p>
          <p class="text-2xl font-semibold">{{ q(a.kpis.ingresos) }}</p>
          <p class="text-xs" [class]="claseVar(a.kpis.ingresosVar)">
            {{ textoVar(a.kpis.ingresosVar) }}
          </p>
        </div>
        <div class="card">
          <p class="muted text-sm">Ventas · ticket promedio</p>
          <p class="text-2xl font-semibold">{{ a.kpis.ventas }} · {{ q(a.kpis.ticketPromedio) }}</p>
          <p class="text-xs" [class]="claseVar(a.kpis.ventasVar)">
            {{ textoVar(a.kpis.ventasVar) }} en ventas
          </p>
        </div>
        <div class="card">
          <p class="muted text-sm">Proyección próximos {{ a.proyeccion.dias }} días</p>
          <p class="text-2xl font-semibold">
            {{ a.pronostico.length ? q(a.proyeccion.esperado) : '—' }}
          </p>
          <p class="muted text-xs">
            @if (a.pronostico.length) {
              Rango {{ q(a.proyeccion.min) }} – {{ q(a.proyeccion.max) }}
            } @else {
              Se necesitan al menos 14 días de ventas
            }
          </p>
        </div>
        <div class="card">
          <p class="muted text-sm">Cobrado, por entregar</p>
          <p class="text-2xl font-semibold">{{ q(a.pendientes.monto) }}</p>
          <p class="muted text-xs">
            {{ a.pendientes.unidades }} libro(s) en {{ a.pendientes.ventas }} venta(s)
          </p>
        </div>
        <div class="card">
          <p class="muted text-sm">Alumnos atendidos · libros</p>
          <p class="text-2xl font-semibold">{{ a.kpis.alumnos }} · {{ a.kpis.unidades }}</p>
        </div>
        <div class="card">
          <p class="muted text-sm">Recargos por tarjeta</p>
          <p class="text-2xl font-semibold">{{ q(a.kpis.recargos) }}</p>
        </div>
        <div class="card">
          <p class="muted text-sm">Descuentos por combos</p>
          <p class="text-2xl font-semibold">{{ q(a.kpis.descuentos) }}</p>
        </div>
        <div class="card">
          <p class="muted text-sm">Anulaciones</p>
          <p class="text-2xl font-semibold">{{ a.kpis.anuladas }} · {{ q(a.kpis.montoAnulado) }}</p>
        </div>
      </div>

      <!-- Ventas y pronóstico -->
      <div class="card mb-4">
        <div class="mb-2">
          <p class="font-medium">Ventas diarias y pronóstico</p>
          <p class="muted text-sm">
            @if (a.proyeccion.tendenciaSemanalPct !== null) {
              Tendencia: {{ a.proyeccion.tendenciaSemanalPct >= 0 ? 'crece' : 'baja' }}
              {{ abs(a.proyeccion.tendenciaSemanalPct) }} % por semana. Pronóstico por tendencia y
              día de la semana; el rango cubre el 80 % de los casos esperados.
            } @else {
              Con más días de historia se mostrará el pronóstico.
            }
          </p>
        </div>
        <app-linea-pronostico [serie]="a.serie" [pronostico]="a.pronostico" />
      </div>

      <!-- Desgloses -->
      <div class="mb-4 grid gap-4 lg:grid-cols-2">
        <div class="card">
          <p class="mb-3 font-medium">Ingresos por colegio</p>
          <app-barras titulo="Ingresos por colegio" [items]="barrasColegio()" />
        </div>
        <div class="card">
          <p class="mb-1 font-medium">Cobrado por método de pago</p>
          <p class="muted mb-3 text-xs">Incluye recargos; pase el cursor para ver el detalle.</p>
          <app-barras titulo="Cobrado por método de pago" [items]="barrasMetodo()" />
        </div>
        <div class="card">
          <p class="mb-3 font-medium">Ingresos por grado</p>
          <app-barras titulo="Ingresos por grado" [items]="barrasGrado()" />
        </div>
        <div class="card">
          <p class="mb-1 font-medium">Libros más vendidos (unidades)</p>
          <p class="muted mb-3 text-xs">↑/↓: última semana contra la anterior.</p>
          <app-barras titulo="Libros más vendidos" etiquetas="12rem" [items]="barrasLibros()" />
        </div>
      </div>

      <div class="mb-4 grid gap-4 lg:grid-cols-2">
        <div class="card">
          <p class="mb-1 font-medium">Libros pagados por entregar, por antigüedad</p>
          <p class="muted mb-3 text-xs">
            Cuanto más tiempo espera un padre, mayor el riesgo de reclamo.
          </p>
          <app-barras titulo="Pendientes por antigüedad" [items]="barrasAntiguedad()" />
          @if (a.pendientes.porEstado.length) {
            <p class="mb-1 mt-4 text-sm font-medium">Por estado</p>
            @for (e of a.pendientes.porEstado; track e.estado) {
              <div class="flex justify-between text-sm">
                <span>{{ estado(e.estado) }}</span
                ><span class="tabular-nums">{{ e.unidades }}</span>
              </div>
            }
          }
        </div>
        <div class="card">
          <p class="mb-3 font-medium">Cuadres de caja del período</p>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="muted">Turnos</p>
              <p class="text-xl font-semibold">{{ a.caja.turnos }}</p>
            </div>
            <div>
              <p class="muted">Por validar</p>
              <p class="text-xl font-semibold">{{ a.caja.porValidar }}</p>
            </div>
            <div>
              <p class="muted">Con faltante</p>
              <p class="text-xl font-semibold">
                {{ a.caja.faltantes }} · {{ q(abs(+a.caja.montoFaltante)) }}
              </p>
            </div>
            <div>
              <p class="muted">Con sobrante</p>
              <p class="text-xl font-semibold">
                {{ a.caja.sobrantes }} · {{ q(a.caja.montoSobrante) }}
              </p>
            </div>
          </div>
          <a
            class="btn-ghost btn-sm mt-3"
            routerLink="/reportes"
            [queryParams]="{ vista: 'tablas', tipo: 'diferencias' }"
            >Ver diferencias por cajero</a
          >
        </div>
      </div>

      <div id="abastecimiento" class="card scroll-mt-4">
        <app-abastecimiento [datos]="a.abastecimiento" (cambiado)="cargar()" />
      </div>
    } @else if (!cargando()) {
      <p class="muted">No se pudo cargar el análisis.</p>
    }
  `,
})
export class AnalisisComponent implements OnInit {
  private readonly api = inject(ReportesApi);
  private readonly colegiosSrv = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  private readonly ancla = inject(ActivatedRoute).snapshot.fragment;
  readonly periodos = [30, 60, 90];
  readonly dias = signal(30);
  readonly colegioId = signal<number | null>(null);
  readonly colegios = signal<Colegio[]>([]);
  readonly a = signal<Analisis | null>(null);
  readonly cargando = signal(false);

  ngOnInit() {
    this.colegiosSrv
      .listar('', 1, 200)
      .subscribe((r) => this.colegios.set(r.data.filter((c) => c.activo)));
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.api.analisis(this.dias(), this.colegioId()).subscribe({
      next: (a) => {
        this.a.set(a);
        this.cargando.set(false);
        // Llegada desde "Ver y crear" (Traslados / Pedidos): baja a las sugerencias.
        if (this.ancla)
          setTimeout(
            () => document.getElementById(this.ancla!)?.scrollIntoView({ behavior: 'smooth' }),
            50,
          );
      },
      error: (e) => {
        this.cargando.set(false);
        this.toast.error(mensajeError(e));
      },
    });
  }

  ir(e: Event, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  readonly barrasColegio = computed<Barra[]>(() =>
    (this.a()?.porColegio ?? []).map((c) => ({
      etiqueta: c.colegio,
      valor: Number(c.ingresos),
      texto: qCompleto(c.ingresos),
      detalle: `${c.ventas} venta(s) · ticket promedio ${qCompleto(c.ticket)}`,
    })),
  );
  readonly barrasMetodo = computed<Barra[]>(() =>
    (this.a()?.porMetodo ?? []).map((m) => ({
      etiqueta: m.metodo,
      valor: Number(m.total),
      texto: qCompleto(m.total),
      detalle: `${m.pagos} pago(s) · base ${qCompleto(m.base)} · recargo ${qCompleto(m.recargo)}`,
    })),
  );
  readonly barrasGrado = computed<Barra[]>(() =>
    (this.a()?.porGrado ?? []).map((g) => ({
      etiqueta: g.grado,
      valor: Number(g.ingresos),
      texto: qCompleto(g.ingresos),
      detalle: `${g.alumnos} alumno(s) · ${g.unidades} libro(s)`,
    })),
  );
  readonly barrasLibros = computed<Barra[]>(() =>
    (this.a()?.topLibros ?? []).map((l) => {
      const flecha = l.ultimos7 > l.previos7 ? ' ↑' : l.ultimos7 < l.previos7 ? ' ↓' : '';
      return {
        etiqueta: l.titulo,
        valor: l.unidades,
        texto: `${l.unidades}${flecha}`,
        detalle: `${qCompleto(l.ingresos)} · última semana ${l.ultimos7}, anterior ${l.previos7}`,
      };
    }),
  );
  readonly barrasAntiguedad = computed<Barra[]>(() =>
    (this.a()?.pendientes.antiguedad ?? []).map((t, i) => ({
      etiqueta: t.tramo,
      valor: t.unidades,
      texto: `${t.unidades} libro(s)`,
      // El tramo más viejo se marca como crítico (con su etiqueta, nunca solo por color).
      ...(i === 3 && t.unidades
        ? { color: 'var(--viz-critico)', texto: `${t.unidades} libro(s) ▲` }
        : {}),
    })),
  );

  nivel(n: keyof typeof NIVEL) {
    return NIVEL[n];
  }
  q(v: string | number) {
    return qCompleto(v);
  }
  abs(v: number) {
    return Math.abs(v);
  }
  estado(e: string) {
    return ESTADO_LINEA[e as EstadoLinea]?.texto ?? e;
  }
  textoVar(v: number | null) {
    if (v === null) return 'Sin período anterior para comparar';
    return `${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${Math.abs(v)} % vs. los ${this.dias()} días anteriores`;
  }
  claseVar(v: number | null) {
    if (v === null || v === 0) return 'muted';
    return v > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';
  }
}
