import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface Barra {
  etiqueta: string;
  valor: number;
  /** Valor ya formateado para mostrar en la punta (p. ej. "Q12,450.00" o "34"). */
  texto: string;
  /** Detalle adicional al pasar el cursor / para lectores de pantalla. */
  detalle?: string;
  /** Color de estado (solo para barras que representan un estado, con su etiqueta). */
  color?: string;
}

/**
 * Barras horizontales: una serie, valor en la punta (texto en tinta normal, nunca del color
 * de la barra), barra de máx. 20 px con extremo redondeado y base recta.
 */
@Component({
  selector: 'app-barras',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-2" [attr.aria-label]="titulo()">
      @for (b of items(); track b.etiqueta) {
        <li class="grid items-center gap-x-3" [style.grid-template-columns]="columnas()">
          <span class="truncate text-sm" [title]="b.etiqueta">{{ b.etiqueta }}</span>
          <span class="flex min-w-0 items-center gap-2" [title]="b.detalle ?? b.texto">
            <span
              class="block h-5 shrink-0 rounded-r"
              [style.width.%]="ancho(b.valor)"
              [style.min-width.px]="b.valor > 0 ? 2 : 0"
              [style.background]="b.color ?? 'var(--viz-serie)'"
            ></span>
            <span class="whitespace-nowrap text-sm tabular-nums">{{ b.texto }}</span>
          </span>
          @if (b.detalle) {
            <span class="sr-only">{{ b.detalle }}</span>
          }
        </li>
      } @empty {
        <li class="muted text-sm">Sin datos en el período.</li>
      }
    </ul>
  `,
})
export class BarrasComponent {
  readonly items = input.required<Barra[]>();
  readonly titulo = input('');
  /** Ancho de la columna de etiquetas. */
  readonly etiquetas = input('9rem');
  readonly columnas = computed(() => `minmax(0, ${this.etiquetas()}) minmax(0, 1fr)`);
  private readonly max = computed(() => Math.max(...this.items().map((b) => b.valor), 0));
  /** Deja ~30 % libre para que el valor quepa a la derecha de la barra más larga. */
  ancho(v: number) {
    return this.max() ? (v / this.max()) * 70 : 0;
  }
}
