import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import {
  ESTADO_TRASLADO,
  EstadoTraslado,
  FilaTraslado,
  LogisticaApi,
  Sugerencia,
  Traslado,
} from '../../core/inventario/logistica.api';
import { CatalogoApi, Libro } from '../../core/catalogo/catalogo.api';
import { Colegio, ColegiosService } from '../admin/colegios/colegios.service';
import { AvisoSugerenciasComponent } from '../reportes/aviso-sugerencias.component';

interface ItemForm {
  libroId: number;
  titulo: string;
  cantidad: number;
}

/**
 * CU-13: sugerencias de traslado (R-05), creación, despacho y recepción.
 * Al recibir, lo que llega se reserva automáticamente para las ventas pendientes (FIFO).
 */
@Component({
  selector: 'app-traslados',
  imports: [DatePipe, FormsModule, AvisoSugerenciasComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-aviso-sugerencias tipo="TRASLADO" />
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Traslados entre colegios</h1>
        <p class="muted">{{ sugerencias().length }} libro(s) esperando traslado</p>
      </div>
      <button class="btn-primary" (click)="nuevo()">Nuevo traslado</button>
    </div>

    @if (form()) {
      <div class="card mb-4 space-y-3">
        <p class="font-medium">Nuevo traslado</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <label class="label" for="origen">Origen</label>
            <select id="origen" class="input" [(ngModel)]="origenId">
              @for (c of colegios(); track c.id) {
                <option [ngValue]="c.id">{{ c.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="label" for="destino">Destino</label>
            <select id="destino" class="input" [(ngModel)]="destinoId">
              @for (c of colegios(); track c.id) {
                <option [ngValue]="c.id">{{ c.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="label" for="obs">Observación</label>
            <input id="obs" class="input" maxlength="250" [(ngModel)]="observacion" />
          </div>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Libro</th>
              <th class="w-32 text-right">Cantidad</th>
              <th class="w-8"></th>
            </tr>
          </thead>
          <tbody>
            @for (it of items(); track it.libroId; let i = $index) {
              <tr>
                <td>{{ it.titulo }}</td>
                <td class="text-right">
                  <input
                    class="input w-24 text-right"
                    type="number"
                    min="1"
                    [ngModel]="it.cantidad"
                    (ngModelChange)="cambiarCantidad(i, $event)"
                  />
                </td>
                <td>
                  <button class="btn-ghost btn-sm" aria-label="Quitar" (click)="quitar(i)">
                    ✕
                  </button>
                </td>
              </tr>
            }
            <tr>
              <td colspan="3">
                <select
                  class="input"
                  aria-label="Agregar libro"
                  (change)="
                    agregar(+$any($event.target).value || null); $any($event.target).value = ''
                  "
                >
                  <option value="">+ Agregar libro…</option>
                  @for (l of librosLibres(); track l.id) {
                    <option [value]="l.id">{{ l.titulo }}</option>
                  }
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex flex-wrap justify-end gap-2">
          <button class="btn-secondary" (click)="form.set(false)">Cancelar</button>
          <button class="btn-secondary" [disabled]="!valido()" (click)="guardar(false)">
            Guardar borrador
          </button>
          <button class="btn-primary" [disabled]="!valido()" (click)="guardar(true)">
            Crear y despachar
          </button>
        </div>
      </div>
    }

    @if (sugerencias().length) {
      <div class="card mb-4 overflow-x-auto p-0">
        <p class="px-3 pt-3 font-medium">Sugerencias (ventas pendientes de traslado)</p>
        <table class="table">
          <thead>
            <tr>
              <th>Destino</th>
              <th>Libro</th>
              <th class="text-right">Pendientes</th>
              <th class="text-right">Días</th>
              <th>Colegios con excedente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (s of sugerencias(); track s.destinoId + '-' + s.libroId) {
              <tr>
                <td>{{ s.destino }}</td>
                <td>{{ s.titulo }}</td>
                <td class="text-right">{{ s.pendientes }}</td>
                <td class="text-right">{{ s.diasEspera }}</td>
                <td class="text-xs">
                  @for (o of s.origenes; track o.colegioId) {
                    <span class="badge-ok mr-1 whitespace-nowrap"
                      >{{ o.colegio }}: {{ o.excedente }}</span
                    >
                  } @empty {
                    <span class="text-amber-600">Ninguno: pedir al proveedor</span>
                  }
                </td>
                <td class="text-right">
                  @if (s.origenes.length) {
                    <button class="btn-ghost btn-sm" (click)="desdeSugerencia(s)">Trasladar</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (detalle(); as t) {
      <div class="card mb-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-medium">
            Traslado T-{{ t.id }} · {{ t.origen }} → {{ t.destino }}
            <span [class]="estado(t.estado).clase">{{ estado(t.estado).texto }}</span>
          </p>
          <button class="btn-ghost btn-sm" (click)="detalle.set(null)">Cerrar</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Libro</th>
              <th class="text-right">Enviado</th>
              <th class="w-32 text-right">
                {{ t.estado === 'EN_TRANSITO' ? 'Recibido' : 'Recibido' }}
              </th>
            </tr>
          </thead>
          <tbody>
            @for (it of t.items; track it.libroId) {
              <tr>
                <td>{{ it.titulo }}</td>
                <td class="text-right">{{ it.cantidad }}</td>
                <td class="text-right">
                  @if (t.estado === 'EN_TRANSITO') {
                    <input
                      class="input w-24 text-right"
                      type="number"
                      min="0"
                      [max]="it.cantidad"
                      [ngModel]="recibido()[it.libroId]"
                      (ngModelChange)="fijarRecibido(it.libroId, $event)"
                    />
                  } @else {
                    {{ t.estado === 'RECIBIDO' ? it.recibido : '—' }}
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (t.observacion) {
          <p class="text-sm"><span class="label inline">Observación:</span> {{ t.observacion }}</p>
        }
        @if (t.estado === 'EN_TRANSITO' && hayFaltante()) {
          <input
            class="input"
            maxlength="200"
            placeholder="Llegó menos de lo enviado: describa la incidencia (obligatorio)"
            [(ngModel)]="incidencia"
          />
        }
        <div class="flex justify-end gap-2">
          @if (t.estado === 'BORRADOR') {
            <button class="btn-danger" (click)="cancelar(t)">Cancelar traslado</button>
            <button class="btn-primary" (click)="despachar(t)">Despachar</button>
          }
          @if (t.estado === 'EN_TRANSITO') {
            <button
              class="btn-primary"
              [disabled]="hayFaltante() && !incidencia.trim()"
              (click)="recibir(t)"
            >
              Confirmar recepción
            </button>
          }
        </div>
      </div>
    }

    <div class="mb-2 flex items-center justify-between">
      <p class="font-medium">Traslados</p>
      <select
        class="input w-44"
        aria-label="Estado"
        (change)="filtro = $any($event.target).value; cargar()"
      >
        <option value="">Todos</option>
        @for (e of estados; track e) {
          <option [value]="e">{{ estado(e).texto }}</option>
        }
      </select>
    </div>
    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Origen → destino</th>
            <th class="text-right">Unidades</th>
            <th>Creado</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (t of lista(); track t.id) {
            <tr
              class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
              (click)="abrir(t.id)"
            >
              <td class="font-mono text-xs">T-{{ t.id }}</td>
              <td>{{ t.origen }} → {{ t.destino }}</td>
              <td class="text-right">{{ t.unidades }}</td>
              <td class="whitespace-nowrap">{{ t.creadoEn | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>
                <span [class]="estado(t.estado).clase">{{ estado(t.estado).texto }}</span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="py-8 text-center muted">Sin traslados</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TrasladosComponent implements OnInit {
  private readonly api = inject(LogisticaApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly colegiosService = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  readonly estados: EstadoTraslado[] = ['BORRADOR', 'EN_TRANSITO', 'RECIBIDO', 'CANCELADO'];

  readonly sugerencias = signal<Sugerencia[]>([]);
  readonly lista = signal<FilaTraslado[]>([]);
  readonly colegios = signal<Colegio[]>([]);
  readonly libros = signal<Libro[]>([]);
  readonly form = signal(false);
  readonly items = signal<ItemForm[]>([]);
  readonly detalle = signal<Traslado | null>(null);
  readonly recibido = signal<Record<number, number>>({});
  origenId: number | null = null;
  destinoId: number | null = null;
  observacion = '';
  incidencia = '';
  filtro = '';

  readonly librosLibres = computed(() => {
    const usados = new Set(this.items().map((i) => i.libroId));
    return this.libros().filter((l) => !usados.has(l.id));
  });
  readonly hayFaltante = computed(() => {
    const t = this.detalle();
    const r = this.recibido();
    return !!t && t.items.some((it) => (r[it.libroId] ?? it.cantidad) < it.cantidad);
  });

  ngOnInit() {
    this.colegiosService
      .listar('', 1, 200)
      .subscribe((r) => this.colegios.set(r.data.filter((c) => c.activo)));
    this.catalogo.libros('', 1, 200, true).subscribe((r) => this.libros.set(r.data));
    this.cargar();
  }

  estado(e: EstadoTraslado) {
    return ESTADO_TRASLADO[e];
  }

  cargar() {
    this.api.sugerencias().subscribe((s) => this.sugerencias.set(s));
    this.api.traslados(this.filtro).subscribe({
      next: (r) => this.lista.set(r.data),
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  valido() {
    return (
      !!this.origenId &&
      !!this.destinoId &&
      this.origenId !== this.destinoId &&
      this.items().length > 0 &&
      this.items().every((i) => Number.isInteger(i.cantidad) && i.cantidad > 0)
    );
  }

  nuevo() {
    this.origenId = this.colegios()[0]?.id ?? null;
    this.destinoId = this.colegios()[1]?.id ?? null;
    this.observacion = '';
    this.items.set([]);
    this.form.set(true);
  }

  /** Prellena con el colegio de mayor excedente y la cantidad que alcanza. */
  desdeSugerencia(s: Sugerencia) {
    const o = s.origenes[0];
    this.origenId = o.colegioId;
    this.destinoId = s.destinoId;
    this.observacion = '';
    // Agrupa: otras sugerencias con el mismo origen y destino entran al mismo traslado.
    const mismas = this.sugerencias().filter(
      (x) => x.destinoId === s.destinoId && x.origenes.some((y) => y.colegioId === o.colegioId),
    );
    this.items.set(
      mismas.map((x) => ({
        libroId: x.libroId,
        titulo: x.titulo,
        cantidad: Math.min(
          x.pendientes,
          x.origenes.find((y) => y.colegioId === o.colegioId)!.excedente,
        ),
      })),
    );
    this.form.set(true);
  }

  agregar(id: number | null) {
    const l = this.libros().find((x) => x.id === id);
    if (l) this.items.update((it) => [...it, { libroId: l.id, titulo: l.titulo, cantidad: 1 }]);
  }
  quitar(i: number) {
    this.items.update((it) => it.filter((_, j) => j !== i));
  }
  cambiarCantidad(i: number, v: number) {
    this.items.update((it) =>
      it.map((x, j) => (j === i ? { ...x, cantidad: Math.floor(Number(v) || 0) } : x)),
    );
  }

  guardar(despachar: boolean) {
    this.api
      .crearTraslado({
        origenId: this.origenId!,
        destinoId: this.destinoId!,
        observacion: this.observacion.trim() || undefined,
        items: this.items().map((i) => ({ libroId: i.libroId, cantidad: i.cantidad })),
        despachar,
      })
      .subscribe({
        next: (t) => {
          this.toast.ok(
            despachar ? `Traslado T-${t.id} despachado` : `Borrador T-${t.id} guardado`,
          );
          this.form.set(false);
          this.cargar();
          this.mostrar(t);
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }

  abrir(id: number) {
    this.api.traslado(id).subscribe((t) => this.mostrar(t));
  }

  private mostrar(t: Traslado) {
    this.detalle.set(t);
    this.incidencia = '';
    this.recibido.set(Object.fromEntries(t.items.map((i) => [i.libroId, i.cantidad])));
  }

  fijarRecibido(libroId: number, v: number) {
    this.recibido.update((r) => ({ ...r, [libroId]: Math.max(0, Math.floor(Number(v) || 0)) }));
  }

  despachar(t: Traslado) {
    if (!confirm(`¿Despachar T-${t.id}? Se descuenta del inventario de ${t.origen}.`)) return;
    this.api.despachar(t.id).subscribe({
      next: (r) => {
        this.toast.ok('Traslado despachado');
        this.mostrar(r);
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  recibir(t: Traslado) {
    const r = this.recibido();
    this.api
      .recibir(t.id, {
        items: t.items.map((i) => ({ libroId: i.libroId, recibido: r[i.libroId] ?? i.cantidad })),
        observacion: this.incidencia.trim() || undefined,
      })
      .subscribe({
        next: (x) => {
          this.toast.ok(
            `Recepción registrada${x.reservadosParaPendientes ? `: ${x.reservadosParaPendientes} libro(s) reservados para ventas pendientes` : ''}`,
          );
          this.mostrar(x.traslado);
          this.cargar();
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }

  cancelar(t: Traslado) {
    if (!confirm(`¿Cancelar el borrador T-${t.id}?`)) return;
    this.api.cancelarTraslado(t.id).subscribe({
      next: (r) => {
        this.mostrar(r);
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
