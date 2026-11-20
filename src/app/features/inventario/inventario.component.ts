import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { CatalogoApi, FilaInventario, Movimiento } from '../../core/catalogo/catalogo.api';
import { ColegioSelectComponent } from '../../shared/colegio-select.component';

type Panel = 'ingreso' | 'ajuste' | 'movimientos' | null;

const TIPO_LABEL: Record<string, string> = {
  INGRESO: 'Ingreso',
  AJUSTE: 'Ajuste',
  VENTA_ENTREGA: 'Entrega de venta',
  RESERVA: 'Reserva',
  LIBERA: 'Libera reserva',
  TRASLADO_SALIDA: 'Traslado (salida)',
  TRASLADO_ENTRADA: 'Traslado (entrada)',
  ANULACION: 'Anulación',
  PROVEEDOR_ENTRADA: 'Entrada de proveedor',
};

/** Existencias por colegio, ingreso de mercadería, ajustes por conteo y kardex por libro. */
@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [FormsModule, DatePipe, ColegioSelectComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="page-title">Inventario</h1>
        <p class="muted">{{ totalUnidades() }} unidades en {{ conExistencia() }} títulos</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <app-colegio-select [(colegioId)]="colegioId" />
        <input
          class="input w-56"
          placeholder="Buscar por título o ISBN"
          (input)="buscar($any($event.target).value)"
        />
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            [ngModel]="soloExistencia()"
            (ngModelChange)="soloExistencia.set($event)"
          />
          Solo con existencia
        </label>
        @if (esAdmin) {
          <button class="btn-primary" (click)="abrirIngreso()">Ingreso de mercadería</button>
        }
      </div>
    </div>

    @switch (panel()) {
      @case ('ingreso') {
        <div class="card mb-4 space-y-3">
          <h2 class="font-medium">Ingreso de mercadería</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="label" for="ref">Referencia (factura, envío…)</label>
              <input id="ref" class="input" maxlength="60" [(ngModel)]="referencia" />
            </div>
            <div>
              <label class="label" for="mot">Observación</label>
              <input id="mot" class="input" maxlength="250" [(ngModel)]="motivo" />
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Libro</th>
                  <th class="w-24 text-right">Actual</th>
                  <th class="w-32 text-right">Cantidad que entra</th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody>
                @for (l of lineas(); track l.libroId; let i = $index) {
                  <tr>
                    <td>{{ fila(l.libroId)?.titulo }}</td>
                    <td class="text-right">{{ fila(l.libroId)?.existencia }}</td>
                    <td class="text-right">
                      <input
                        class="input w-28 text-right"
                        type="number"
                        min="1"
                        [ngModel]="l.cantidad"
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
                  <td colspan="4">
                    <select
                      class="input"
                      aria-label="Agregar libro"
                      [ngModel]="null"
                      (ngModelChange)="agregar($event)"
                    >
                      <option [ngValue]="null">+ Agregar libro…</option>
                      @for (f of libresIngreso(); track f.libroId) {
                        <option [ngValue]="f.libroId">{{ f.titulo }}</option>
                      }
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" (click)="panel.set(null)">Cancelar</button>
            <button
              class="btn-primary"
              [disabled]="!ingresoValido() || guardando()"
              (click)="guardarIngreso()"
            >
              Registrar ingreso ({{ unidadesIngreso() }} u.)
            </button>
          </div>
        </div>
      }
      @case ('ajuste') {
        <div class="card mb-4 grid gap-3 sm:grid-cols-4">
          <h2 class="font-medium sm:col-span-4">Ajuste por conteo · {{ seleccion()?.titulo }}</h2>
          <div>
            <p class="label">Existencia en sistema</p>
            <p class="py-2 text-sm">
              {{ seleccion()?.existencia }} (reservado {{ seleccion()?.reservado }})
            </p>
          </div>
          <div>
            <label class="label" for="cont">Existencia contada</label>
            <input id="cont" class="input text-right" type="number" min="0" [(ngModel)]="contado" />
            @if (diferencia() !== 0) {
              <p
                class="mt-1 text-xs"
                [class]="diferencia() > 0 ? 'text-emerald-600' : 'text-rose-600'"
              >
                Diferencia: {{ diferencia() > 0 ? '+' : '' }}{{ diferencia() }}
              </p>
            }
          </div>
          <div class="sm:col-span-2">
            <label class="label" for="mtv">Motivo (obligatorio)</label>
            <input
              id="mtv"
              class="input"
              maxlength="250"
              [(ngModel)]="motivo"
              placeholder="Ej. conteo físico, libro dañado"
            />
          </div>
          <div class="flex justify-end gap-2 sm:col-span-4">
            <button class="btn-secondary" (click)="panel.set(null)">Cancelar</button>
            <button
              class="btn-primary"
              [disabled]="!motivo.trim() || diferencia() === 0 || contado < 0 || guardando()"
              (click)="guardarAjuste()"
            >
              Guardar ajuste
            </button>
          </div>
        </div>
      }
      @case ('movimientos') {
        <div class="card mb-4">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="font-medium">Movimientos · {{ seleccion()?.titulo }}</h2>
            <button class="btn-ghost btn-sm" (click)="panel.set(null)">Cerrar</button>
          </div>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th class="text-right">Cantidad</th>
                  <th>Referencia</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                @for (m of movimientos(); track m.id) {
                  <tr>
                    <td class="whitespace-nowrap">{{ m.fecha | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td>{{ tipo(m.tipo) }}</td>
                    <td
                      class="text-right"
                      [class]="m.cantidad > 0 ? 'text-emerald-600' : 'text-rose-600'"
                    >
                      {{ m.cantidad > 0 ? '+' : '' }}{{ m.cantidad }}
                    </td>
                    <td>{{ m.referencia || '—' }}</td>
                    <td>{{ m.motivo || '—' }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="py-6 text-center muted">Sin movimientos</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (movTotal() > movimientos().length) {
            <div class="mt-2 text-right">
              <button class="btn-secondary btn-sm" (click)="masMovimientos()">Ver más</button>
            </div>
          }
        </div>
      }
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Libro</th>
            <th>ISBN</th>
            <th class="text-right">Existencia</th>
            <th class="text-right">Reservado</th>
            <th class="text-right">Disponible</th>
            <th class="text-right" title="Unidades vendidas pendientes de traslado/proveedor">
              Pendientes
            </th>
            <th class="text-right" title="Disponible menos pendientes propios">Excedente</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (f of filas(); track f.libroId) {
            <tr>
              <td>{{ f.titulo }}</td>
              <td class="font-mono text-xs">{{ f.isbn || '—' }}</td>
              <td class="text-right">{{ f.existencia }}</td>
              <td class="text-right">{{ f.reservado }}</td>
              <td class="text-right font-medium" [class.text-rose-600]="f.disponible === 0">
                {{ f.disponible }}
              </td>
              <td class="text-right">{{ f.pendientes }}</td>
              <td class="text-right" [class.text-rose-600]="f.excedente < 0">{{ f.excedente }}</td>
              <td class="whitespace-nowrap text-right">
                <button class="btn-ghost btn-sm" (click)="verMovimientos(f)">Movimientos</button>
                @if (esAdmin) {
                  <button class="btn-ghost btn-sm" (click)="abrirAjuste(f)">Ajustar</button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="py-8 text-center muted">Sin registros</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class InventarioComponent {
  private readonly api = inject(CatalogoApi);
  private readonly toast = inject(ToastService);
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');

  readonly colegioId = signal<number | null>(null);
  readonly soloExistencia = signal(false);
  readonly filas = signal<FilaInventario[]>([]);
  readonly panel = signal<Panel>(null);
  readonly guardando = signal(false);
  readonly seleccion = signal<FilaInventario | null>(null);
  readonly lineas = signal<{ libroId: number; cantidad: number }[]>([]);
  readonly movimientos = signal<Movimiento[]>([]);
  readonly movTotal = signal(0);
  private movPage = 1;
  private q = '';
  private timer?: ReturnType<typeof setTimeout>;
  referencia = '';
  motivo = '';
  contado = 0;

  readonly totalUnidades = computed(() => this.filas().reduce((a, f) => a + f.existencia, 0));
  readonly conExistencia = computed(() => this.filas().filter((f) => f.existencia > 0).length);
  readonly libresIngreso = computed(() => {
    const usados = new Set(this.lineas().map((l) => l.libroId));
    return this.todos().filter((f) => !usados.has(f.libroId));
  });
  readonly unidadesIngreso = computed(() =>
    this.lineas().reduce((a, l) => a + (l.cantidad || 0), 0),
  );
  readonly ingresoValido = computed(
    () =>
      this.lineas().length > 0 &&
      this.lineas().every((l) => Number.isInteger(l.cantidad) && l.cantidad > 0),
  );
  /** Lista completa (sin filtros) para elegir libros en el ingreso. */
  private readonly todos = signal<FilaInventario[]>([]);

  constructor() {
    effect(() => {
      const id = this.colegioId();
      this.soloExistencia();
      untracked(() => {
        if (id) {
          this.panel.set(null);
          this.cargar();
        }
      });
    });
  }

  diferencia() {
    return (Number(this.contado) || 0) - (this.seleccion()?.existencia ?? 0);
  }

  tipo(t: string) {
    return TIPO_LABEL[t] ?? t;
  }

  fila(libroId: number) {
    return this.todos().find((f) => f.libroId === libroId);
  }

  cargar() {
    const id = this.colegioId();
    if (!id) return;
    this.api.inventario(id, this.q, this.soloExistencia()).subscribe({
      next: (r) => {
        this.filas.set(r);
        if (!this.q && !this.soloExistencia()) this.todos.set(r);
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  buscar(q: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q = q.trim();
      this.cargar();
    }, 300);
  }

  abrirIngreso() {
    this.referencia = '';
    this.motivo = '';
    this.lineas.set([]);
    if (!this.todos().length || this.q || this.soloExistencia())
      this.api.inventario(this.colegioId(), '', false).subscribe((r) => this.todos.set(r));
    this.panel.set('ingreso');
  }

  agregar(libroId: number | null) {
    if (libroId) this.lineas.update((ls) => [...ls, { libroId, cantidad: 1 }]);
  }
  quitar(i: number) {
    this.lineas.update((ls) => ls.filter((_, j) => j !== i));
  }
  cambiarCantidad(i: number, v: number) {
    this.lineas.update((ls) => ls.map((l, j) => (j === i ? { ...l, cantidad: Number(v) } : l)));
  }

  guardarIngreso() {
    const colegioId = this.colegioId();
    if (!colegioId || !this.ingresoValido()) return;
    this.guardando.set(true);
    this.api
      .ingreso({
        colegioId,
        referencia: this.referencia.trim() || undefined,
        motivo: this.motivo.trim() || undefined,
        items: this.lineas(),
      })
      .subscribe({
        next: () => {
          this.toast.ok(`Ingreso registrado: ${this.unidadesIngreso()} unidades`);
          this.guardando.set(false);
          this.panel.set(null);
          this.cargar();
        },
        error: (e) => {
          this.toast.error(mensajeError(e));
          this.guardando.set(false);
        },
      });
  }

  abrirAjuste(f: FilaInventario) {
    this.seleccion.set(f);
    this.contado = f.existencia;
    this.motivo = '';
    this.panel.set('ajuste');
  }

  guardarAjuste() {
    const colegioId = this.colegioId();
    const f = this.seleccion();
    if (!colegioId || !f) return;
    this.guardando.set(true);
    this.api
      .ajuste({
        colegioId,
        libroId: f.libroId,
        existencia: Number(this.contado),
        motivo: this.motivo.trim(),
      })
      .subscribe({
        next: (r) => {
          this.toast.ok(`Ajuste guardado (${r.diferencia > 0 ? '+' : ''}${r.diferencia})`);
          this.guardando.set(false);
          this.panel.set(null);
          this.cargar();
        },
        error: (e) => {
          this.toast.error(mensajeError(e));
          this.guardando.set(false);
        },
      });
  }

  verMovimientos(f: FilaInventario) {
    this.seleccion.set(f);
    this.movPage = 1;
    this.movimientos.set([]);
    this.panel.set('movimientos');
    this.cargarMovimientos();
  }

  masMovimientos() {
    this.movPage++;
    this.cargarMovimientos();
  }

  private cargarMovimientos() {
    const f = this.seleccion();
    if (!f) return;
    this.api.movimientos(this.colegioId(), f.libroId, this.movPage).subscribe({
      next: (r) => {
        this.movimientos.update((m) => [...m, ...r.data]);
        this.movTotal.set(r.total);
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
