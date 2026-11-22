import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { ddmm, diaSemana, marcas, qCompacto, qCompleto } from './escala';

interface Punto {
  dia: string;
  real: number | null;
  esperado: number | null;
  min: number | null;
  max: number | null;
}

const ALTO = 240;
const M = { arriba: 12, derecha: 16, abajo: 28, izquierda: 52 };

/**
 * Ventas diarias reales (línea sólida) y pronóstico (línea discontinua con banda del rango
 * probable). Puntero: línea vertical que sigue al cursor con el detalle del día.
 */
@Component({
  selector: 'app-linea-pronostico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-2 flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
      <span class="flex items-center gap-1.5"
        ><svg width="18" height="6" aria-hidden="true">
          <line x1="0" y1="3" x2="18" y2="3" stroke="var(--viz-serie)" stroke-width="2" /></svg
        >Ventas reales</span
      >
      <span class="flex items-center gap-1.5"
        ><svg width="18" height="10" aria-hidden="true">
          <rect x="0" y="0" width="18" height="10" fill="var(--viz-serie-banda)" />
          <line
            x1="0"
            y1="5"
            x2="18"
            y2="5"
            stroke="var(--viz-serie)"
            stroke-width="2"
            stroke-dasharray="4 3"
          /></svg
        >Pronóstico y rango probable (80 %)</span
      >
    </div>
    <div #caja class="relative w-full" (pointerleave)="indice.set(null)">
      @if (ancho() > 0) {
        <svg
          [attr.width]="ancho()"
          [attr.height]="alto"
          role="img"
          [attr.aria-label]="resumen()"
          (pointermove)="mover($event)"
        >
          @for (t of ejeY(); track t) {
            <line
              [attr.x1]="M.izquierda"
              [attr.x2]="ancho() - M.derecha"
              [attr.y1]="y(t)"
              [attr.y2]="y(t)"
              [attr.stroke]="t === 0 ? 'var(--viz-eje)' : 'var(--viz-grilla)'"
              stroke-width="1"
            />
            <text
              [attr.x]="M.izquierda - 8"
              [attr.y]="y(t) + 4"
              text-anchor="end"
              class="fill-zinc-500 text-[11px] tabular-nums"
            >
              {{ qc(t) }}
            </text>
          }
          @for (e of ejeX(); track e.i) {
            <text
              [attr.x]="x(e.i)"
              [attr.y]="alto - 8"
              text-anchor="middle"
              class="fill-zinc-500 text-[11px]"
            >
              {{ e.texto }}
            </text>
          }
          @if (iHoy() !== null) {
            <line
              [attr.x1]="x(iHoy()!)"
              [attr.x2]="x(iHoy()!)"
              [attr.y1]="M.arriba"
              [attr.y2]="alto - M.abajo"
              stroke="var(--viz-eje)"
              stroke-width="1"
            />
            <text
              [attr.x]="x(iHoy()!) + 4"
              [attr.y]="M.arriba + 10"
              class="fill-zinc-500 text-[11px]"
            >
              hoy
            </text>
          }
          <path [attr.d]="banda()" fill="var(--viz-serie-banda)" />
          <path
            [attr.d]="lineaPron()"
            fill="none"
            stroke="var(--viz-serie)"
            stroke-width="2"
            stroke-dasharray="5 4"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <path
            [attr.d]="lineaReal()"
            fill="none"
            stroke="var(--viz-serie)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          @if (indice() !== null) {
            @let p = puntos()[indice()!];
            <line
              [attr.x1]="x(indice()!)"
              [attr.x2]="x(indice()!)"
              [attr.y1]="M.arriba"
              [attr.y2]="alto - M.abajo"
              stroke="var(--viz-tenue)"
              stroke-width="1"
            />
            @if (p.real !== null && indice() !== iHoy()) {
              <circle
                [attr.cx]="x(indice()!)"
                [attr.cy]="y(p.real)"
                r="4.5"
                fill="var(--viz-serie)"
                stroke="var(--viz-superficie)"
                stroke-width="2"
              />
            }
            @if (p.esperado !== null) {
              <circle
                [attr.cx]="x(indice()!)"
                [attr.cy]="y(p.esperado)"
                r="4.5"
                fill="var(--viz-superficie)"
                stroke="var(--viz-serie)"
                stroke-width="2"
              />
            }
          }
        </svg>
        @if (indice() !== null) {
          @let p = puntos()[indice()!];
          <div
            class="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            [style.left.px]="posTooltip()"
            role="status"
          >
            <p class="muted mb-1">{{ dsem(p.dia) }} {{ dm(p.dia) }}</p>
            @if (p.real !== null) {
              <p class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-1.5"
                  ><span class="inline-block h-0.5 w-3 bg-[var(--viz-serie)]"></span
                  >{{ indice() === iHoy() ? 'Real (en curso)' : 'Real' }}</span
                ><strong class="tabular-nums">{{ qf(p.real) }}</strong>
              </p>
            }
            @if (p.esperado !== null) {
              <p class="flex items-center justify-between gap-3">
                <span class="flex items-center gap-1.5"
                  ><span
                    class="inline-block h-0.5 w-3 border-t-2 border-dashed border-[var(--viz-serie)]"
                  ></span
                  >Pronóstico</span
                ><strong class="tabular-nums">{{ qf(p.esperado) }}</strong>
              </p>
              <p class="muted">Rango {{ qc(p.min!) }} – {{ qc(p.max!) }}</p>
            }
          </div>
        }
      }
    </div>
    <details class="mt-2 text-sm">
      <summary class="muted cursor-pointer text-xs">Ver datos en tabla</summary>
      <div class="mt-2 max-h-64 overflow-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Día</th>
              <th class="text-right">Real</th>
              <th class="text-right">Pronóstico</th>
              <th class="text-right">Rango</th>
            </tr>
          </thead>
          <tbody>
            @for (p of puntos(); track p.dia) {
              <tr>
                <td>{{ dsem(p.dia) }} {{ dm(p.dia) }}</td>
                <td class="money text-right">{{ p.real !== null ? qf(p.real) : '—' }}</td>
                <td class="money text-right">{{ p.esperado !== null ? qf(p.esperado) : '—' }}</td>
                <td class="money text-right">
                  {{ p.esperado !== null ? qc(p.min!) + ' – ' + qc(p.max!) : '' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
})
export class LineaPronosticoComponent implements AfterViewInit, OnDestroy {
  readonly serie = input.required<{ dia: string; total: string }[]>();
  readonly pronostico = input<{ dia: string; esperado: number; min: number; max: number }[]>([]);
  readonly alto = ALTO;
  readonly M = M;
  private readonly caja = viewChild.required<ElementRef<HTMLDivElement>>('caja');
  readonly ancho = signal(0);
  readonly indice = signal<number | null>(null);
  private obs?: ResizeObserver;

  /** Real y pronóstico en un mismo eje de días; hoy puede tener ambos (real parcial). */
  readonly puntos = computed<Punto[]>(() => {
    const mapa = new Map<string, Punto>();
    for (const s of this.serie())
      mapa.set(s.dia, { dia: s.dia, real: Number(s.total), esperado: null, min: null, max: null });
    for (const p of this.pronostico()) {
      const x = mapa.get(p.dia) ?? { dia: p.dia, real: null, esperado: null, min: null, max: null };
      mapa.set(p.dia, { ...x, esperado: p.esperado, min: p.min, max: p.max });
    }
    return [...mapa.values()].sort((a, b) => a.dia.localeCompare(b.dia));
  });
  readonly iHoy = computed(() => {
    const i = this.puntos().findIndex((p) => p.esperado !== null);
    return i >= 0 ? i : null;
  });
  readonly ejeY = computed(() =>
    marcas(Math.max(...this.puntos().map((p) => Math.max(p.real ?? 0, p.max ?? 0)), 1)),
  );
  readonly ejeX = computed(() => {
    const n = this.puntos().length;
    const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(this.ancho() / 70))));
    return this.puntos()
      .map((p, i) => ({ i, texto: ddmm(p.dia) }))
      .filter((e) => e.i % cada === 0);
  });

  x = (i: number) =>
    M.izquierda +
    (i * (this.ancho() - M.izquierda - M.derecha)) / Math.max(1, this.puntos().length - 1);
  y = (v: number) => {
    const tope = this.ejeY()[this.ejeY().length - 1] || 1;
    return M.arriba + (1 - v / tope) * (ALTO - M.arriba - M.abajo);
  };

  /** Hoy aún no termina: su venta parcial no se dibuja en la línea (sí en el tooltip). */
  readonly lineaReal = computed(() =>
    this.camino(
      this.puntos().map((p, i) => (p.real === null || i === this.iHoy() ? null : [i, p.real])),
    ),
  );
  readonly lineaPron = computed(() => {
    // Une el último real (completo, antes de hoy) con el pronóstico para que la línea continúe.
    const ps = this.puntos();
    const hoy = this.iHoy();
    return this.camino(
      ps.map((p, i) => {
        if (p.esperado !== null) return [i, p.esperado];
        if (hoy !== null && i === hoy - 1 && p.real !== null) return [i, p.real];
        return null;
      }),
    );
  });
  readonly banda = computed(() => {
    const ps = this.puntos()
      .map((p, i) => ({ p, i }))
      .filter((x) => x.p.esperado !== null);
    if (!ps.length) return '';
    const arriba = ps.map((x) => `${this.x(x.i)},${this.y(x.p.max!)}`);
    const abajo = [...ps].reverse().map((x) => `${this.x(x.i)},${this.y(x.p.min!)}`);
    return `M${arriba.join('L')}L${abajo.join('L')}Z`;
  });
  readonly posTooltip = computed(() => {
    const i = this.indice();
    if (i === null) return 0;
    const px = this.x(i);
    return px + 180 > this.ancho() ? px - 176 : px + 12;
  });
  readonly resumen = computed(() => {
    const reales = this.puntos().filter((p) => p.real !== null);
    const total = reales.reduce((a, p) => a + (p.real ?? 0), 0);
    const pron = this.pronostico().reduce((a, p) => a + p.esperado, 0);
    return `Ventas diarias de ${reales.length} días, total ${qCompleto(total)}. Pronóstico de ${this.pronostico().length} días: ${qCompleto(pron)}.`;
  });

  private camino(pts: (number[] | null)[]) {
    let d = '';
    let nuevo = true;
    for (const p of pts) {
      if (!p) {
        nuevo = true;
        continue;
      }
      d += `${nuevo ? 'M' : 'L'}${this.x(p[0])},${this.y(p[1])}`;
      nuevo = false;
    }
    return d;
  }

  mover(e: PointerEvent) {
    const n = this.puntos().length;
    if (!n) return;
    const rel = (e.offsetX - M.izquierda) / (this.ancho() - M.izquierda - M.derecha);
    this.indice.set(Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1)))));
  }

  ngAfterViewInit() {
    const el = this.caja().nativeElement;
    this.ancho.set(el.clientWidth);
    this.obs = new ResizeObserver(() => this.ancho.set(el.clientWidth));
    this.obs.observe(el);
  }
  ngOnDestroy() {
    this.obs?.disconnect();
  }

  qc = qCompacto;
  qf = qCompleto;
  dm = ddmm;
  dsem = diaSemana;
}
