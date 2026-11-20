import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { CatalogoApi, Combo, FilaPrecio, Grado } from '../../../core/catalogo/catalogo.api';
import { ColegioSelectComponent } from '../../../shared/colegio-select.component';

interface LineaForm {
  libroId: number;
  cantidad: number;
}

const MONTO = /^\d{1,10}(\.\d{1,2})?$/;
/** Solo para la vista previa; el total oficial lo calcula el servidor. */
const centavos = (v: string | null | undefined) => Math.round(Number(v || 0) * 100);
const q = (c: number) => (c / 100).toFixed(2);

/** Combos por grado: libros del grado con un descuento sobre la suma de precios. */
@Component({
  selector: 'app-combos',
  standalone: true,
  imports: [FormsModule, ColegioSelectComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="page-title">Combos por grado</h1>
        <p class="muted">{{ combos().length }} combos en el ciclo {{ ciclo() }}</p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <app-colegio-select [(colegioId)]="colegioId" />
        <input
          class="input w-24"
          type="number"
          aria-label="Ciclo"
          [ngModel]="ciclo()"
          (ngModelChange)="cambiarCiclo($event)"
        />
        @if (esAdmin) {
          <button class="btn-primary" [disabled]="!gradosLibres().length" (click)="nuevo()">
            Nuevo combo
          </button>
        }
      </div>
    </div>

    @if (panel()) {
      <div class="card mb-4 space-y-4">
        <div class="grid gap-3 sm:grid-cols-3">
          <div>
            <label class="label" for="grado">Grado</label>
            @if (editando()) {
              <input id="grado" class="input" [value]="editando()!.grado.nombre" disabled />
            } @else {
              <select
                id="grado"
                class="input"
                [(ngModel)]="gradoId"
                (ngModelChange)="sugerirNombre()"
              >
                @for (g of gradosLibres(); track g.id) {
                  <option [ngValue]="g.id">{{ g.nombre }}</option>
                }
              </select>
            }
          </div>
          <div>
            <label class="label" for="nombre">Nombre</label>
            <input id="nombre" class="input" maxlength="120" [(ngModel)]="nombre" />
          </div>
          <div>
            <label class="label" for="descuento">Descuento (Q)</label>
            <input
              id="descuento"
              class="input text-right"
              inputmode="decimal"
              [class.input-error]="descuentoInvalido()"
              [ngModel]="descuento()"
              (ngModelChange)="descuento.set($event)"
            />
          </div>
        </div>

        <div>
          <p class="label">Libros del combo</p>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Libro</th>
                  <th class="w-24 text-right">Cantidad</th>
                  <th class="w-28 text-right">Precio</th>
                  <th class="w-28 text-right">Subtotal</th>
                  <th class="w-10"></th>
                </tr>
              </thead>
              <tbody>
                @for (l of lineas(); track l.libroId; let i = $index) {
                  <tr>
                    <td>{{ libro(l.libroId)?.titulo }}</td>
                    <td class="text-right">
                      <input
                        class="input w-20 text-right"
                        type="number"
                        min="1"
                        max="99"
                        [ngModel]="l.cantidad"
                        (ngModelChange)="cambiarCantidad(i, $event)"
                      />
                    </td>
                    <td class="money text-right">
                      @if (libro(l.libroId)?.precio; as p) {
                        {{ p }}
                      } @else {
                        <span class="text-amber-600 dark:text-amber-400">Sin precio</span>
                      }
                    </td>
                    <td class="money text-right">
                      {{ subtotalLinea(l) }}
                    </td>
                    <td class="text-right">
                      <button class="btn-ghost btn-sm" aria-label="Quitar" (click)="quitar(i)">
                        ✕
                      </button>
                    </td>
                  </tr>
                }
                <tr>
                  <td colspan="5">
                    <select
                      class="input"
                      aria-label="Agregar libro"
                      [ngModel]="null"
                      (ngModelChange)="agregar($event)"
                    >
                      <option [ngValue]="null">+ Agregar libro…</option>
                      @for (f of disponibles(); track f.libroId) {
                        <option [ngValue]="f.libroId">
                          {{ f.titulo }} — {{ f.precio ? 'Q' + f.precio : 'sin precio' }}
                        </option>
                      }
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="money text-sm">
            Libros Q{{ vista().subtotal }} − descuento Q{{ vista().descuento }} =
            <strong>Q{{ vista().total }}</strong>
            @if (vista().faltanPrecios) {
              <p class="text-xs text-amber-600 dark:text-amber-400">
                Hay libros sin precio en este colegio y ciclo; el total está incompleto.
              </p>
            }
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary" (click)="panel.set(false)">Cancelar</button>
            <button class="btn-primary" [disabled]="!valido() || guardando()" (click)="guardar()">
              {{ editando() ? 'Guardar cambios' : 'Crear combo' }}
            </button>
          </div>
        </div>
      </div>
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Grado</th>
            <th>Nombre</th>
            <th class="text-right">Libros</th>
            <th class="text-right">Suma</th>
            <th class="text-right">Descuento</th>
            <th class="text-right">Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of combos(); track c.id) {
            <tr>
              <td>{{ c.grado.nombre }}</td>
              <td>{{ c.nombre }}</td>
              <td class="text-right">{{ c.libros.length }}</td>
              <td class="money text-right">{{ c.subtotal }}</td>
              <td class="money text-right">{{ c.descuento }}</td>
              <td class="money text-right font-medium">
                {{ c.total }}
                @if (!c.completo) {
                  <span class="block text-xs text-amber-600 dark:text-amber-400">incompleto</span>
                }
              </td>
              <td>
                <span [class]="c.activo ? 'badge-ok' : 'badge-off'">{{
                  c.activo ? 'Activo' : 'Inactivo'
                }}</span>
              </td>
              <td class="whitespace-nowrap text-right">
                <button class="btn-ghost btn-sm" (click)="toggle(c.id)">
                  {{ abierto() === c.id ? 'Ocultar' : 'Ver' }}
                </button>
                @if (esAdmin) {
                  <button class="btn-ghost btn-sm" (click)="editar(c)">Editar</button>
                  <button class="btn-ghost btn-sm" (click)="activar(c, !c.activo)">
                    {{ c.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                  <button
                    class="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                    (click)="eliminar(c)"
                  >
                    Eliminar
                  </button>
                }
              </td>
            </tr>
            @if (abierto() === c.id) {
              <tr>
                <td colspan="8" class="bg-zinc-50 dark:bg-zinc-900">
                  <ul class="space-y-1 text-sm">
                    @for (l of c.libros; track l.libroId) {
                      <li class="flex justify-between gap-4">
                        <span>{{ l.cantidad }} × {{ l.titulo }}</span>
                        <span class="money">{{ l.precio ?? 'sin precio' }}</span>
                      </li>
                    }
                  </ul>
                </td>
              </tr>
            }
          } @empty {
            <tr>
              <td colspan="8" class="py-8 text-center muted">Sin combos para este ciclo</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class CombosComponent implements OnInit {
  private readonly api = inject(CatalogoApi);
  private readonly toast = inject(ToastService);
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');

  readonly colegioId = signal<number | null>(null);
  readonly ciclo = signal(new Date().getFullYear());
  readonly combos = signal<Combo[]>([]);
  readonly grados = signal<Grado[]>([]);
  readonly precios = signal<FilaPrecio[]>([]);
  readonly abierto = signal<number | null>(null);

  readonly panel = signal(false);
  readonly editando = signal<Combo | null>(null);
  readonly guardando = signal(false);
  readonly lineas = signal<LineaForm[]>([]);
  readonly descuento = signal('0.00');
  gradoId: number | null = null;
  nombre = '';
  private listo = false;

  readonly gradosLibres = computed(() => {
    const usados = new Set(this.combos().map((c) => c.gradoId));
    return this.grados().filter((g) => g.activo && !usados.has(g.id));
  });
  readonly disponibles = computed(() => {
    const usados = new Set(this.lineas().map((l) => l.libroId));
    return this.precios().filter((f) => !usados.has(f.libroId));
  });
  readonly descuentoInvalido = computed(() => !MONTO.test(String(this.descuento()).trim()));
  readonly vista = computed(() => {
    const porLibro = new Map(this.precios().map((f) => [f.libroId, f.precio]));
    const sub = this.lineas().reduce(
      (acc, l) => acc + centavos(porLibro.get(l.libroId)) * l.cantidad,
      0,
    );
    const d = this.descuentoInvalido() ? 0 : centavos(this.descuento());
    return {
      subtotal: q(sub),
      descuento: q(d),
      total: q(Math.max(sub - d, 0)),
      faltanPrecios: this.lineas().some((l) => !porLibro.get(l.libroId)),
    };
  });
  readonly valido = computed(
    () =>
      this.lineas().length > 0 &&
      this.lineas().every(
        (l) => Number.isInteger(l.cantidad) && l.cantidad >= 1 && l.cantidad <= 99,
      ) &&
      !this.descuentoInvalido(),
  );

  constructor() {
    effect(() => {
      const id = this.colegioId();
      untracked(() => {
        if (id && this.listo) this.cargar();
      });
    });
  }

  ngOnInit() {
    this.api.grados().subscribe((g) => this.grados.set(g));
    this.api.cicloActual().subscribe((c) => {
      this.ciclo.set(c);
      this.listo = true;
      if (this.colegioId()) this.cargar();
    });
  }

  cargar() {
    const id = this.colegioId();
    if (!id) return;
    this.panel.set(false);
    this.api.combos(id, this.ciclo()).subscribe({
      next: (r) => this.combos.set(r),
      error: (e) => this.toast.error(mensajeError(e)),
    });
    this.api.precios(id, this.ciclo()).subscribe((r) => this.precios.set(r.items));
  }

  cambiarCiclo(v: number) {
    if (!Number.isInteger(v) || v < 2000 || v > 2100) return;
    this.ciclo.set(v);
    this.cargar();
  }

  toggle(id: number) {
    this.abierto.set(this.abierto() === id ? null : id);
  }

  /** Datos del libro; si está inactivo (fuera de la lista de precios) se toma del combo. */
  libro(id: number): { titulo: string; precio: string | null } | undefined {
    return (
      this.precios().find((f) => f.libroId === id) ??
      this.editando()?.libros.find((l) => l.libroId === id)
    );
  }

  subtotalLinea(l: LineaForm) {
    const p = this.libro(l.libroId)?.precio;
    return p ? q(centavos(p) * l.cantidad) : '—';
  }

  nuevo() {
    this.editando.set(null);
    this.gradoId = this.gradosLibres()[0]?.id ?? null;
    this.sugerirNombre();
    this.descuento.set('0.00');
    this.lineas.set([]);
    this.panel.set(true);
  }

  sugerirNombre() {
    const g = this.grados().find((x) => x.id === this.gradoId);
    if (g) this.nombre = `Combo ${g.nombre} ${this.ciclo()}`;
  }

  editar(c: Combo) {
    this.editando.set(c);
    this.gradoId = c.gradoId;
    this.nombre = c.nombre;
    this.descuento.set(c.descuento);
    this.lineas.set(c.libros.map((l) => ({ libroId: l.libroId, cantidad: l.cantidad })));
    this.panel.set(true);
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

  guardar() {
    const colegioId = this.colegioId();
    if (!colegioId || !this.valido() || !this.nombre.trim()) {
      if (!this.nombre.trim()) this.toast.error('Escriba un nombre para el combo');
      return;
    }
    this.guardando.set(true);
    const base = {
      nombre: this.nombre.trim(),
      descuento: String(this.descuento()).trim(),
      libros: this.lineas(),
    };
    const actual = this.editando();
    const req = actual
      ? this.api.editarCombo(actual.id, base)
      : this.api.crearCombo({ ...base, colegioId, gradoId: this.gradoId!, ciclo: this.ciclo() });
    req.subscribe({
      next: () => {
        this.toast.ok(actual ? 'Combo actualizado' : 'Combo creado');
        this.guardando.set(false);
        this.cargar();
      },
      error: (e) => {
        this.toast.error(mensajeError(e));
        this.guardando.set(false);
      },
    });
  }

  activar(c: Combo, activo: boolean) {
    this.api.editarCombo(c.id, { activo }).subscribe({
      next: () => {
        this.toast.ok(activo ? 'Combo activado' : 'Combo desactivado');
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  eliminar(c: Combo) {
    if (!confirm(`¿Eliminar el combo "${c.nombre}"?`)) return;
    this.api.eliminarCombo(c.id).subscribe({
      next: () => {
        this.toast.ok('Combo eliminado');
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
