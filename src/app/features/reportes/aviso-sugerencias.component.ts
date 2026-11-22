import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReportesApi } from '../../core/reportes/reportes.api';

/** Aviso con las sugerencias del sistema (traslados o pedidos) y acceso al panel de abastecimiento. */
@Component({
  selector: 'app-aviso-sugerencias',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (n() > 0) {
      <div
        class="card mb-4 flex flex-wrap items-center justify-between gap-2 border-amber-400 p-3 text-sm dark:border-amber-700"
        role="status"
      >
        <span>
          <strong
            >El sistema sugiere {{ n() }}
            {{ tipo() === 'TRASLADO' ? 'traslado(s)' : 'pedido(s)' }}</strong
          >
          ({{ unidades() }} libro(s)) para cubrir lo vendido pendiente y la demanda de las próximas
          2 semanas.
        </span>
        <a class="btn-secondary btn-sm" routerLink="/reportes" fragment="abastecimiento"
          >Ver y crear</a
        >
      </div>
    }
  `,
})
export class AvisoSugerenciasComponent implements OnInit {
  private readonly api = inject(ReportesApi);
  readonly tipo = input.required<'TRASLADO' | 'PEDIDO'>();
  readonly n = signal(0);
  readonly unidades = signal(0);
  ngOnInit() {
    this.api.abastecimiento().subscribe({
      next: (a) => {
        const s = a.sugerencias.filter((x) => x.tipo === this.tipo());
        this.n.set(s.length);
        this.unidades.set(s.reduce((t, x) => t + x.cantidad, 0));
      },
      error: () => undefined,
    });
  }
}
