import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { CatalogoApi, FilaPrecio } from '../../../core/catalogo/catalogo.api';
import { norm } from '../../../shared/texto';
import { ColegioSelectComponent } from '../../../shared/colegio-select.component';
import { Colegio, ColegiosService } from '../../admin/colegios/colegios.service';

const MONTO = /^\d{1,10}(\.\d{1,2})?$/;

/** Lista de precios por colegio y ciclo. El Admin edita en la tabla y guarda en bloque. */
@Component({
  selector: 'app-precios',
  standalone: true,
  imports: [FormsModule, ColegioSelectComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="page-title">Precios por colegio</h1>
        <p class="muted">
          {{ conPrecio() }} de {{ filas().length }} libros con precio en el ciclo {{ ciclo() }}
        </p>
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
        <input
          class="input w-56"
          placeholder="Filtrar libros"
          [ngModel]="filtro()"
          (ngModelChange)="filtro.set($event)"
        />
        @if (esAdmin) {
          <button class="btn-secondary" (click)="abrirCopia()">Copiar precios…</button>
        }
      </div>
    </div>

    @if (copia()) {
      <div class="card mb-4 grid gap-3 sm:grid-cols-4">
        <p class="muted sm:col-span-4">
          Copia los precios de otro colegio o ciclo hacia el colegio y ciclo seleccionados.
        </p>
        <div>
          <label class="label" for="cOrigen">Colegio origen</label>
          <select id="cOrigen" class="input" [(ngModel)]="copiaColegio">
            @for (c of colegios(); track c.id) {
              <option [ngValue]="c.id">{{ c.nombre }}</option>
            }
          </select>
        </div>
        <div>
          <label class="label" for="cCiclo">Ciclo origen</label>
          <input id="cCiclo" class="input" type="number" [(ngModel)]="copiaCiclo" />
        </div>
        <label class="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" [(ngModel)]="copiaSobrescribir" /> Reemplazar los existentes
        </label>
        <div class="flex items-end justify-end gap-2">
          <button class="btn-secondary" (click)="copia.set(false)">Cancelar</button>
          <button class="btn-primary" (click)="copiar()">Copiar</button>
        </div>
      </div>
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Libro</th>
            <th>ISBN</th>
            <th class="w-40 text-right">Precio (Q)</th>
          </tr>
        </thead>
        <tbody>
          @for (f of visibles(); track f.libroId) {
            <tr [class]="cambios().has(f.libroId) ? 'bg-amber-50 dark:bg-amber-950/40' : ''">
              <td>
                {{ f.titulo }}
                @if (f.editorial) {
                  <span class="muted text-xs"> · {{ f.editorial }}</span>
                }
              </td>
              <td class="font-mono text-xs">{{ f.isbn || '—' }}</td>
              <td class="money text-right">
                @if (esAdmin) {
                  <input
                    class="input w-32 text-right"
                    inputmode="decimal"
                    placeholder="Sin precio"
                    [class.input-error]="invalido(f.libroId)"
                    [ngModel]="valor(f)"
                    (ngModelChange)="editar(f, $event)"
                  />
                } @else {
                  {{ f.precio ?? '—' }}
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="3" class="py-8 text-center muted">Sin libros</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (esAdmin && cambios().size) {
      <div
        class="sticky bottom-4 mt-4 flex items-center justify-end gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <span class="muted">{{ cambios().size }} cambio(s) sin guardar</span>
        <button class="btn-secondary" (click)="descartar()">Descartar</button>
        <button class="btn-primary" [disabled]="hayInvalidos() || guardando()" (click)="guardar()">
          Guardar precios
        </button>
      </div>
    }
  `,
})
export class PreciosComponent implements OnInit {
  private readonly api = inject(CatalogoApi);
  private readonly colegiosService = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');

  readonly colegioId = signal<number | null>(null);
  readonly ciclo = signal(new Date().getFullYear());
  readonly filas = signal<FilaPrecio[]>([]);
  readonly filtro = signal('');
  /** libroId → texto escrito (vacío = quitar precio) */
  readonly cambios = signal(new Map<number, string>());
  readonly guardando = signal(false);
  readonly copia = signal(false);
  readonly colegios = signal<Colegio[]>([]);
  copiaColegio: number | null = null;
  copiaCiclo = 0;
  copiaSobrescribir = false;
  private listo = false;

  readonly visibles = computed(() => {
    const q = norm(this.filtro().trim());
    if (!q) return this.filas();
    return this.filas().filter((f) => norm(f.titulo).includes(q) || norm(f.isbn).includes(q));
  });
  readonly conPrecio = computed(() => this.filas().filter((f) => f.precio !== null).length);
  readonly hayInvalidos = computed(() =>
    [...this.cambios().values()].some((v) => v.trim() !== '' && !MONTO.test(v.trim())),
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
    this.api.cicloActual().subscribe((c) => {
      this.ciclo.set(c);
      this.listo = true;
      if (this.colegioId()) this.cargar();
    });
  }

  cargar() {
    if (!this.colegioId()) return;
    this.api.precios(this.colegioId(), this.ciclo()).subscribe({
      next: (r) => {
        this.filas.set(r.items);
        this.cambios.set(new Map());
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  cambiarCiclo(v: number) {
    if (!Number.isInteger(v) || v < 2000 || v > 2100) return;
    if (this.cambios().size && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
    this.ciclo.set(v);
    this.cargar();
  }

  valor(f: FilaPrecio) {
    return this.cambios().get(f.libroId) ?? f.precio ?? '';
  }

  invalido(libroId: number) {
    const v = this.cambios().get(libroId);
    return v !== undefined && v.trim() !== '' && !MONTO.test(v.trim());
  }

  editar(f: FilaPrecio, v: string) {
    const m = new Map(this.cambios());
    const normal = (x: string | null) =>
      x === null || x.trim() === '' ? '' : Number(x).toFixed(2);
    const igual = MONTO.test(v.trim()) || v.trim() === '' ? normal(v) === normal(f.precio) : false;
    if (igual) m.delete(f.libroId);
    else m.set(f.libroId, v);
    this.cambios.set(m);
  }

  descartar() {
    this.cambios.set(new Map());
  }

  guardar() {
    const colegioId = this.colegioId();
    if (!colegioId || this.hayInvalidos()) return;
    const items = [...this.cambios().entries()].map(([libroId, v]) => ({
      libroId,
      precio: v.trim() === '' ? null : v.trim(),
    }));
    const quitados = items.filter((i) => i.precio === null).length;
    if (quitados && !confirm(`Se quitará el precio de ${quitados} libro(s). ¿Continuar?`)) return;
    this.guardando.set(true);
    this.api.guardarPrecios(colegioId, this.ciclo(), items).subscribe({
      next: (r) => {
        this.toast.ok(`${r.cambios} precio(s) guardado(s)`);
        this.guardando.set(false);
        this.cargar();
      },
      error: (e) => {
        this.toast.error(mensajeError(e));
        this.guardando.set(false);
      },
    });
  }

  abrirCopia() {
    this.copiaCiclo = this.ciclo() - 1;
    this.copiaColegio = this.colegioId();
    this.copiaSobrescribir = false;
    if (!this.colegios().length)
      this.colegiosService
        .listar('', 1, 200)
        .subscribe((r) => this.colegios.set(r.data.filter((c) => c.activo)));
    this.copia.set(true);
  }

  copiar() {
    const destino = this.colegioId();
    if (!destino || !this.copiaColegio) return;
    this.api
      .copiarPrecios({
        colegioOrigenId: this.copiaColegio,
        cicloOrigen: Number(this.copiaCiclo),
        colegioDestinoId: destino,
        cicloDestino: this.ciclo(),
        sobrescribir: this.copiaSobrescribir,
      })
      .subscribe({
        next: (r) => {
          this.toast.ok(`${r.copiados} precio(s) copiado(s)`);
          this.copia.set(false);
          this.cargar();
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }
}
