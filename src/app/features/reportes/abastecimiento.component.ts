import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { LogisticaApi } from '../../core/inventario/logistica.api';
import { Abastecimiento, Riesgo, Sugerencia } from '../../core/reportes/reportes.api';

export const RIESGO: Record<Riesgo, { texto: string; icono: string; color: string }> = {
  CRITICO: { texto: 'Crítico', icono: '▲', color: 'var(--viz-critico)' },
  ALTO: { texto: 'Alto', icono: '●', color: 'var(--viz-serio)' },
  MEDIO: { texto: 'Medio', icono: '◆', color: 'var(--viz-aviso)' },
  OK: { texto: 'Cubierto', icono: '✓', color: 'var(--viz-bien)' },
};

interface Fila extends Sugerencia {
  clave: string;
  creado: boolean;
}

/**
 * Sugerencias de traslado y de pedido a proveedor calculadas por el sistema, con acción directa.
 * Los traslados se crean en BORRADOR (alguien los revisa y despacha); los pedidos, SOLICITADOS.
 */
@Component({
  selector: 'app-abastecimiento',
  imports: [FormsModule, RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @let d = datos();
    <div class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-medium">Sugerencias del sistema</p>
          <p class="muted text-sm">
            Para cubrir lo vendido y pendiente más la demanda esperada de los próximos
            {{ d.horizonteDias }} días. Primero se traslada desde colegios con excedente (sin
            dejarlos cortos); lo que no alcanza se pide al proveedor.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn-secondary btn-sm"
            [disabled]="procesando() || !traslados().length"
            (click)="crearTodosTraslados()"
          >
            Crear {{ traslados().length }} traslado(s) en borrador
          </button>
          <button
            class="btn-primary btn-sm"
            [disabled]="procesando() || !pedidos().length"
            (click)="crearTodosPedidos()"
          >
            Crear pedidos ({{ pedidos().length }} libro(s))
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Riesgo</th>
              <th>Acción</th>
              <th>Libro</th>
              <th>Para</th>
              <th class="w-24 text-right">Cantidad</th>
              <th>Desde / proveedor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of filas(); track s.clave) {
              <tr [class.opacity-50]="s.creado">
                <td class="whitespace-nowrap">
                  <span [style.color]="riesgo(s.riesgo).color" aria-hidden="true">{{
                    riesgo(s.riesgo).icono
                  }}</span>
                  {{ riesgo(s.riesgo).texto }}
                </td>
                <td>
                  <span [class]="s.tipo === 'TRASLADO' ? 'badge-ok' : 'badge-warn'">{{
                    s.tipo === 'TRASLADO' ? 'Trasladar' : 'Pedir'
                  }}</span>
                </td>
                <td class="min-w-48">
                  {{ s.titulo }}
                  <span class="muted block text-xs">{{ s.motivo }}</span>
                </td>
                <td>{{ s.destino }}</td>
                <td class="text-right">
                  <input
                    class="input w-20 text-right"
                    type="number"
                    min="1"
                    max="9999"
                    [attr.aria-label]="'Cantidad de ' + s.titulo"
                    [disabled]="s.creado"
                    [(ngModel)]="s.cantidad"
                  />
                </td>
                <td>
                  @if (s.tipo === 'TRASLADO') {
                    {{ s.origen }}
                  } @else {
                    <select
                      class="input w-44"
                      [attr.aria-label]="'Proveedor para ' + s.titulo"
                      [disabled]="s.creado"
                      [(ngModel)]="s.proveedorId"
                    >
                      <option [ngValue]="null">— Elija proveedor —</option>
                      @for (p of d.proveedores; track p.id) {
                        <option [ngValue]="p.id">{{ p.nombre }}</option>
                      }
                    </select>
                  }
                </td>
                <td class="text-right">
                  @if (s.creado) {
                    <span class="badge-ok">Creado</span>
                  } @else {
                    <button
                      class="btn-secondary btn-sm whitespace-nowrap"
                      [disabled]="
                        procesando() || s.cantidad < 1 || (s.tipo === 'PEDIDO' && !s.proveedorId)
                      "
                      (click)="crearUno(s)"
                    >
                      {{ s.tipo === 'TRASLADO' ? 'Crear traslado' : 'Crear pedido' }}
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="muted py-6 text-center">
                  Todo cubierto: no hay faltantes previstos para los próximos
                  {{ d.horizonteDias }} días.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="muted text-xs">
        Los traslados quedan en borrador en
        <a class="underline" routerLink="/inventario/traslados">Traslados</a> para revisarlos y
        despacharlos; los pedidos, en
        <a class="underline" routerLink="/inventario/pedidos">Pedidos a proveedor</a>.
      </p>

      <details class="text-sm" [open]="false">
        <summary class="cursor-pointer font-medium">
          Cobertura por libro y colegio ({{ enRiesgo().length }} con riesgo)
        </summary>
        <label class="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" [(ngModel)]="todos" /> Mostrar también los cubiertos
        </label>
        <div class="mt-2 overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Riesgo</th>
                <th>Colegio</th>
                <th>Libro</th>
                <th class="text-right">Disponible</th>
                <th class="text-right">Vendidos esperando</th>
                <th class="text-right">En camino</th>
                <th class="text-right">Demanda / día</th>
                <th class="text-right">Alcanza para</th>
                <th class="text-right">Faltan ({{ d.horizonteDias }} d)</th>
              </tr>
            </thead>
            <tbody>
              @for (f of todos ? d.filas : enRiesgo(); track f.colegioId + '-' + f.libroId) {
                <tr>
                  <td class="whitespace-nowrap">
                    <span [style.color]="riesgo(f.riesgo).color" aria-hidden="true">{{
                      riesgo(f.riesgo).icono
                    }}</span>
                    {{ riesgo(f.riesgo).texto }}
                  </td>
                  <td>{{ f.colegio }}</td>
                  <td>{{ f.titulo }}</td>
                  <td class="text-right tabular-nums">{{ f.disponible }}</td>
                  <td class="text-right tabular-nums">{{ f.pendientes || '—' }}</td>
                  <td class="text-right tabular-nums">{{ f.enCamino || '—' }}</td>
                  <td class="text-right tabular-nums">{{ f.demandaDiaria }}</td>
                  <td class="text-right tabular-nums">
                    {{
                      f.diasCobertura === null
                        ? 'sin ventas'
                        : (f.diasCobertura | number: '1.0-0') + ' día(s)'
                    }}
                  </td>
                  <td class="text-right font-medium tabular-nums">{{ f.faltante || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `,
})
export class AbastecimientoComponent {
  private readonly api = inject(LogisticaApi);
  private readonly toast = inject(ToastService);
  readonly datos = input.required<Abastecimiento>();
  readonly cambiado = output<void>();
  readonly procesando = signal(false);
  readonly filas = signal<Fila[]>([]);
  todos = false;

  readonly enRiesgo = computed(() => this.datos().filas.filter((f) => f.riesgo !== 'OK'));
  readonly traslados = computed(() =>
    this.filas().filter((s) => s.tipo === 'TRASLADO' && !s.creado),
  );
  readonly pedidos = computed(() =>
    this.filas().filter((s) => s.tipo === 'PEDIDO' && !s.creado && s.proveedorId),
  );

  constructor() {
    effect(() =>
      this.filas.set(
        this.datos().sugerencias.map((s, i) => ({ ...s, clave: `${s.tipo}-${i}`, creado: false })),
      ),
    );
  }

  riesgo(r: Riesgo) {
    return RIESGO[r];
  }

  private traslado$(origenId: number, destinoId: number, ss: Fila[]) {
    return this.api.crearTraslado({
      origenId,
      destinoId,
      observacion: 'Sugerido por el sistema (abastecimiento)',
      items: ss.map((s) => ({ libroId: s.libroId, cantidad: Math.floor(s.cantidad) })),
    });
  }
  private pedido$(proveedorId: number, destinoId: number, ss: Fila[]) {
    return this.api.crearPedido({
      proveedorId,
      colegioDestinoId: destinoId,
      observacion: 'Sugerido por el sistema (abastecimiento)',
      items: ss.map((s) => ({ libroId: s.libroId, solicitado: Math.floor(s.cantidad) })),
    });
  }

  /** Agrupa por (origen o proveedor) y destino: un documento por par. */
  private agrupar(ss: Fila[], llave: (s: Fila) => number) {
    const g = new Map<string, Fila[]>();
    for (const s of ss) {
      const k = `${llave(s)}-${s.destinoId}`;
      g.set(k, [...(g.get(k) ?? []), s]);
    }
    return [...g.values()];
  }

  private ejecutar(trabajos: { obs: Observable<unknown>; filas: Fila[] }[], mensaje: string) {
    if (!trabajos.length) return;
    this.procesando.set(true);
    forkJoin(trabajos.map((t) => t.obs)).subscribe({
      next: () => {
        const creadas = new Set(trabajos.flatMap((t) => t.filas.map((f) => f.clave)));
        this.filas.update((fs) =>
          fs.map((f) => (creadas.has(f.clave) ? { ...f, creado: true } : f)),
        );
        this.procesando.set(false);
        this.toast.ok(mensaje);
        this.cambiado.emit();
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.error(mensajeError(e));
        this.cambiado.emit();
      },
    });
  }

  crearUno(s: Fila) {
    const obs =
      s.tipo === 'TRASLADO'
        ? this.traslado$(s.origenId!, s.destinoId, [s])
        : this.pedido$(s.proveedorId!, s.destinoId, [s]);
    this.ejecutar(
      [{ obs, filas: [s] }],
      s.tipo === 'TRASLADO'
        ? `Traslado ${s.origen} → ${s.destino} creado en borrador`
        : `Pedido de ${s.cantidad} "${s.titulo}" creado`,
    );
  }

  crearTodosTraslados() {
    const grupos = this.agrupar(this.traslados(), (s) => s.origenId!);
    this.ejecutar(
      grupos.map((g) => ({ obs: this.traslado$(g[0].origenId!, g[0].destinoId, g), filas: g })),
      `${grupos.length} traslado(s) creados en borrador: revíselos y despáchelos`,
    );
  }

  crearTodosPedidos() {
    const grupos = this.agrupar(this.pedidos(), (s) => s.proveedorId!);
    this.ejecutar(
      grupos.map((g) => ({ obs: this.pedido$(g[0].proveedorId!, g[0].destinoId, g), filas: g })),
      `${grupos.length} pedido(s) a proveedor creados`,
    );
  }
}
