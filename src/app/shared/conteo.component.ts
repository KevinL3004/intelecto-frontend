import { Component, computed, input, output, signal } from '@angular/core';
import { Conteo, Denominacion } from '../core/ventas/ventas.api';

/** Conteo de efectivo por billete y moneda. Emite el conteo cada vez que cambia. */
@Component({
  selector: 'app-conteo',
  standalone: true,
  template: `
    <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      @for (grupo of grupos(); track grupo.tipo) {
        <div>
          <p class="label">{{ grupo.tipo === 'BILLETE' ? 'Billetes' : 'Monedas' }}</p>
          <div class="space-y-1">
            @for (d of grupo.items; track d.id) {
              <div class="flex items-center gap-2">
                <label class="w-16 text-right text-sm tabular-nums" [for]="'den' + d.id"
                  >Q{{ etiqueta(d.valor) }}</label
                >
                <span class="muted">×</span>
                <input
                  class="input w-24 text-right tabular-nums"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  [id]="'den' + d.id"
                  [value]="cantidades()[d.id] || ''"
                  placeholder="0"
                  (input)="cambiar(d.id, $any($event.target).value)"
                />
                <span class="money muted w-24 text-right text-sm">{{ subtotal(d) }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
    <p class="mt-3 text-right text-base">
      Total contado: <strong class="money">Q{{ total() }}</strong>
    </p>
  `,
})
export class ConteoComponent {
  readonly denominaciones = input.required<Denominacion[]>();
  readonly cambio = output<{ conteo: Conteo[]; total: string }>();
  readonly cantidades = signal<Record<number, number>>({});

  readonly grupos = computed(() => {
    const ds = this.denominaciones();
    return (['BILLETE', 'MONEDA'] as const)
      .map((tipo) => ({ tipo, items: ds.filter((d) => d.tipo === tipo) }))
      .filter((g) => g.items.length);
  });

  /** Suma en centavos enteros para no usar flotantes; solo es informativo, el backend recalcula. */
  readonly total = computed(() => {
    const c = this.cantidades();
    const centavos = this.denominaciones().reduce(
      (a, d) => a + Math.round(Number(d.valor) * 100) * (c[d.id] || 0),
      0,
    );
    return (centavos / 100).toFixed(2);
  });

  etiqueta(v: string) {
    const n = Number(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  subtotal(d: Denominacion) {
    const q = this.cantidades()[d.id] || 0;
    return q ? ((Math.round(Number(d.valor) * 100) * q) / 100).toFixed(2) : '';
  }

  cambiar(id: number, v: string) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    this.cantidades.update((c) => ({ ...c, [id]: n }));
    this.cambio.emit({
      conteo: Object.entries(this.cantidades())
        .filter(([, q]) => q > 0)
        .map(([k, q]) => ({ denominacionId: Number(k), cantidad: q })),
      total: this.total(),
    });
  }
}
