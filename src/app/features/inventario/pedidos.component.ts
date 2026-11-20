import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import {
  ESTADO_PEDIDO,
  EstadoPedido,
  FilaPedido,
  LogisticaApi,
  Pedido,
  PorPedir,
  Proveedor,
} from '../../core/inventario/logistica.api';
import { CatalogoApi, Libro } from '../../core/catalogo/catalogo.api';
import { Colegio, ColegiosService } from '../admin/colegios/colegios.service';

interface ItemForm {
  libroId: number;
  titulo: string;
  solicitado: number;
}

/** CU-14: consolidado por pedir (R-06), pedidos a proveedor y recepción total o parcial. */
@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Pedidos a proveedor</h1>
        <p class="muted">{{ porPedir().length }} libro(s) por pedir</p>
      </div>
      <div class="flex gap-2">
        <a class="btn-secondary" routerLink="/inventario/proveedores">Proveedores</a>
        <button class="btn-primary" (click)="nuevo()">Nuevo pedido</button>
      </div>
    </div>

    @if (form()) {
      <div class="card mb-4 space-y-3">
        <p class="font-medium">Nuevo pedido</p>
        @if (!proveedores().length) {
          <p class="text-sm text-amber-600">
            No hay proveedores activos.
            <a class="underline" routerLink="/inventario/proveedores">Registre uno</a>.
          </p>
        }
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <label class="label" for="prov">Proveedor</label>
            <select id="prov" class="input" [(ngModel)]="proveedorId">
              @for (p of proveedores(); track p.id) {
                <option [ngValue]="p.id">{{ p.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="label" for="dest">Colegio destino</label>
            <select id="dest" class="input" [(ngModel)]="colegioId">
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
                    [ngModel]="it.solicitado"
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
        <div class="flex justify-end gap-2">
          <button class="btn-secondary" (click)="form.set(false)">Cancelar</button>
          <button class="btn-primary" [disabled]="!valido()" (click)="guardar()">
            Crear pedido
          </button>
        </div>
      </div>
    }

    @if (porPedir().length) {
      <div class="card mb-4 overflow-x-auto p-0">
        <p class="px-3 pt-3 font-medium">Por pedir (ventas pendientes de proveedor)</p>
        <table class="table">
          <thead>
            <tr>
              <th>Colegio</th>
              <th>Libro</th>
              <th>Editorial</th>
              <th class="text-right">Pendientes</th>
              <th class="text-right">Días</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of porPedir(); track p.colegioId + '-' + p.libroId) {
              <tr>
                <td>{{ p.colegio }}</td>
                <td>{{ p.titulo }}</td>
                <td>{{ p.editorial || '—' }}</td>
                <td class="text-right">{{ p.pendientes }}</td>
                <td class="text-right">{{ p.diasEspera }}</td>
                <td class="text-right">
                  <button class="btn-ghost btn-sm" (click)="desdePendiente(p)">Pedir</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (detalle(); as p) {
      <div class="card mb-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-medium">
            Pedido P-{{ p.id }} · {{ p.proveedor }} → {{ p.colegio }}
            <span [class]="estado(p.estado).clase">{{ estado(p.estado).texto }}</span>
          </p>
          <button class="btn-ghost btn-sm" (click)="detalle.set(null)">Cerrar</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Libro</th>
              <th class="text-right">Pedido</th>
              <th class="text-right">Recibido</th>
              @if (abierto(p)) {
                <th class="w-32 text-right">Llega ahora</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (it of p.items; track it.libroId) {
              <tr>
                <td>{{ it.titulo }}</td>
                <td class="text-right">{{ it.solicitado }}</td>
                <td class="text-right">{{ it.recibido }}</td>
                @if (abierto(p)) {
                  <td class="text-right">
                    <input
                      class="input w-24 text-right"
                      type="number"
                      min="0"
                      [max]="it.solicitado - it.recibido"
                      [ngModel]="llega()[it.libroId] || 0"
                      (ngModelChange)="fijarLlega(it.libroId, $event)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
        @if (abierto(p)) {
          <div class="flex flex-wrap items-center justify-end gap-2">
            <input
              class="input w-56"
              maxlength="60"
              placeholder="Factura / envío (opcional)"
              [(ngModel)]="referencia"
            />
            <button class="btn-secondary btn-sm" (click)="todoPendiente(p)">Llegó todo</button>
            <button class="btn-danger" (click)="cancelar(p)">Cancelar pedido</button>
            <button class="btn-primary" [disabled]="!hayLlegada()" (click)="recibir(p)">
              Registrar recepción
            </button>
          </div>
        }
      </div>
    }

    <div class="mb-2 flex items-center justify-between">
      <p class="font-medium">Pedidos</p>
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
            <th>Proveedor</th>
            <th>Destino</th>
            <th class="text-right">Recibido / pedido</th>
            <th>Creado</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (p of lista(); track p.id) {
            <tr
              class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
              (click)="abrir(p.id)"
            >
              <td class="font-mono text-xs">P-{{ p.id }}</td>
              <td>{{ p.proveedor }}</td>
              <td>{{ p.colegio }}</td>
              <td class="text-right">{{ p.recibido }} / {{ p.solicitado }}</td>
              <td class="whitespace-nowrap">{{ p.creadoEn | date: 'dd/MM/yyyy' }}</td>
              <td>
                <span [class]="estado(p.estado).clase">{{ estado(p.estado).texto }}</span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="py-8 text-center muted">Sin pedidos</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class PedidosComponent implements OnInit {
  private readonly api = inject(LogisticaApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly colegiosService = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  readonly estados: EstadoPedido[] = ['SOLICITADO', 'PARCIAL', 'RECIBIDO', 'CANCELADO'];

  readonly porPedir = signal<PorPedir[]>([]);
  readonly lista = signal<FilaPedido[]>([]);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly colegios = signal<Colegio[]>([]);
  readonly libros = signal<Libro[]>([]);
  readonly form = signal(false);
  readonly items = signal<ItemForm[]>([]);
  readonly detalle = signal<Pedido | null>(null);
  readonly llega = signal<Record<number, number>>({});
  proveedorId: number | null = null;
  colegioId: number | null = null;
  observacion = '';
  referencia = '';
  filtro = '';

  readonly librosLibres = computed(() => {
    const usados = new Set(this.items().map((i) => i.libroId));
    return this.libros().filter((l) => !usados.has(l.id));
  });
  readonly hayLlegada = computed(() => Object.values(this.llega()).some((q) => q > 0));

  ngOnInit() {
    this.colegiosService
      .listar('', 1, 200)
      .subscribe((r) => this.colegios.set(r.data.filter((c) => c.activo)));
    this.catalogo.libros('', 1, 200, true).subscribe((r) => this.libros.set(r.data));
    this.api.proveedores('', true).subscribe((r) => this.proveedores.set(r.data));
    this.cargar();
  }

  estado(e: EstadoPedido) {
    return ESTADO_PEDIDO[e];
  }
  abierto(p: Pedido) {
    return p.estado === 'SOLICITADO' || p.estado === 'PARCIAL';
  }

  cargar() {
    this.api.porPedir().subscribe((r) => this.porPedir.set(r));
    this.api.pedidos(this.filtro).subscribe({
      next: (r) => this.lista.set(r.data),
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  valido() {
    return (
      !!this.proveedorId &&
      !!this.colegioId &&
      this.items().length > 0 &&
      this.items().every((i) => Number.isInteger(i.solicitado) && i.solicitado > 0)
    );
  }

  nuevo() {
    this.proveedorId = this.proveedores()[0]?.id ?? null;
    this.colegioId = this.colegios()[0]?.id ?? null;
    this.observacion = '';
    this.items.set([]);
    this.form.set(true);
  }

  /** Prellena con todo lo pendiente de ese colegio. */
  desdePendiente(p: PorPedir) {
    this.nuevo();
    this.colegioId = p.colegioId;
    this.items.set(
      this.porPedir()
        .filter((x) => x.colegioId === p.colegioId)
        .map((x) => ({ libroId: x.libroId, titulo: x.titulo, solicitado: x.pendientes })),
    );
  }

  agregar(id: number | null) {
    const l = this.libros().find((x) => x.id === id);
    if (l) this.items.update((it) => [...it, { libroId: l.id, titulo: l.titulo, solicitado: 1 }]);
  }
  quitar(i: number) {
    this.items.update((it) => it.filter((_, j) => j !== i));
  }
  cambiarCantidad(i: number, v: number) {
    this.items.update((it) =>
      it.map((x, j) => (j === i ? { ...x, solicitado: Math.floor(Number(v) || 0) } : x)),
    );
  }

  guardar() {
    this.api
      .crearPedido({
        proveedorId: this.proveedorId!,
        colegioDestinoId: this.colegioId!,
        observacion: this.observacion.trim() || undefined,
        items: this.items().map((i) => ({ libroId: i.libroId, solicitado: i.solicitado })),
      })
      .subscribe({
        next: (p) => {
          this.toast.ok(`Pedido P-${p.id} creado`);
          this.form.set(false);
          this.cargar();
          this.mostrar(p);
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }

  abrir(id: number) {
    this.api.pedido(id).subscribe((p) => this.mostrar(p));
  }
  private mostrar(p: Pedido) {
    this.detalle.set(p);
    this.llega.set({});
    this.referencia = '';
  }
  fijarLlega(libroId: number, v: number) {
    this.llega.update((r) => ({ ...r, [libroId]: Math.max(0, Math.floor(Number(v) || 0)) }));
  }
  todoPendiente(p: Pedido) {
    this.llega.set(Object.fromEntries(p.items.map((i) => [i.libroId, i.solicitado - i.recibido])));
  }

  recibir(p: Pedido) {
    const items = Object.entries(this.llega())
      .filter(([, q]) => q > 0)
      .map(([id, cantidad]) => ({ libroId: Number(id), cantidad }));
    this.api.recepcion(p.id, { items, referencia: this.referencia.trim() || undefined }).subscribe({
      next: (r) => {
        this.toast.ok(
          `Recepción registrada${r.reservadosParaPendientes ? `: ${r.reservadosParaPendientes} libro(s) reservados para ventas pendientes` : ''}`,
        );
        this.mostrar(r.pedido);
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  cancelar(p: Pedido) {
    if (!confirm(`¿Cancelar el pedido P-${p.id}? Lo que no llegó vuelve a "por pedir".`)) return;
    this.api.cancelarPedido(p.id).subscribe({
      next: (r) => {
        this.mostrar(r);
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
