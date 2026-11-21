import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { AdminApi, Parametro } from '../../../core/admin/admin.api';

/** Nombres legibles; el orden de esta lista es el orden en pantalla. */
const ETIQUETAS: Record<string, string> = {
  nombre_empresa: 'Nombre de la empresa',
  nit_empresa: 'NIT de la empresa',
  direccion_empresa: 'Dirección',
  telefono_empresa: 'Teléfono',
  correo_empresa: 'Correo de contacto',
  sitio_licencias: 'Sitio web de las licencias digitales',
  pie_comprobante: 'Texto al pie del comprobante',
  ciclo_actual: 'Ciclo escolar vigente',
  monto_minimo_nit: 'Monto mínimo para exigir NIT',
  dias_vencimiento_pedido: 'Días de vencimiento de pedidos (fase 2)',
};

/** Parámetros generales (solo Admin): datos del comprobante y ciclo escolar. Quedan en bitácora. */
@Component({
  selector: 'app-configuracion',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h1 class="page-title">Configuración</h1>
    <p class="muted mb-4">
      Datos que se imprimen en el comprobante y parámetros generales. Cada cambio queda en la
      bitácora.
    </p>
    <div class="card divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
      @for (p of params(); track p.clave) {
        <div class="grid gap-2 p-4 sm:grid-cols-3 sm:items-center">
          <div>
            <label class="font-medium" [for]="p.clave">{{ etiqueta(p.clave) }}</label>
            <p class="muted text-xs">{{ p.descripcion }}</p>
          </div>
          <input
            class="input sm:col-span-1"
            maxlength="250"
            [id]="p.clave"
            [ngModel]="valores[p.clave]"
            (ngModelChange)="valores[p.clave] = $event"
          />
          <div class="flex items-center justify-end gap-2">
            <span class="muted text-xs">{{ p.actualizadoEn | date: 'dd/MM/yyyy' }}</span>
            <button
              class="btn-secondary btn-sm"
              [disabled]="(valores[p.clave] ?? '').trim() === p.valor"
              (click)="guardar(p)"
            >
              Guardar
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ConfiguracionComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  readonly params = signal<Parametro[]>([]);
  valores: Record<string, string> = {};

  ngOnInit() {
    this.api.parametros().subscribe({
      next: (ps) => {
        const orden = Object.keys(ETIQUETAS);
        const pos = (c: string) => (orden.includes(c) ? orden.indexOf(c) : orden.length);
        this.params.set([...ps].sort((a, b) => pos(a.clave) - pos(b.clave)));
        this.valores = Object.fromEntries(ps.map((p) => [p.clave, p.valor]));
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  etiqueta(c: string) {
    return ETIQUETAS[c] ?? c;
  }

  guardar(p: Parametro) {
    this.api.editarParametro(p.clave, (this.valores[p.clave] ?? '').trim()).subscribe({
      next: (x) => {
        this.params.update((ps) => ps.map((y) => (y.clave === x.clave ? x : y)));
        this.valores[x.clave] = x.valor;
        this.toast.ok('Guardado');
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
