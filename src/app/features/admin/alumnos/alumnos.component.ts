import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { CatalogoApi, Grado } from '../../../core/catalogo/catalogo.api';
import { AdminApi, Persona } from '../../../core/admin/admin.api';
import { Alumno, AlumnoDetalle, VentasApi } from '../../../core/ventas/ventas.api';
import { QuetzalPipe } from '../../../shared/quetzal.pipe';

const PARENTESCO: Record<string, string> = {
  PADRE: 'Padre',
  MADRE: 'Madre',
  ENCARGADO: 'Encargado',
  OTRO: 'Otro',
};

/**
 * Alumnos (datos de menores: solo Admin y Contador). Se registran solos al vender;
 * aquí se consultan, se corrigen y se vinculan con sus padres o encargados.
 */
@Component({
  selector: 'app-alumnos',
  imports: [FormsModule, DatePipe, RouterLink, QuetzalPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Alumnos</h1>
        <p class="muted">{{ total() }} registrados · se agregan automáticamente al vender</p>
      </div>
      <input
        class="input w-72"
        placeholder="Buscar por alumno o por padre/encargado"
        aria-label="Buscar alumnos"
        (input)="buscar($any($event.target).value)"
      />
    </div>

    @if (sel(); as a) {
      <div class="card mb-4 space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="font-medium">{{ a.nombre }}</p>
            <p class="muted text-sm">
              {{ a.colegio ?? 'Sin colegio' }} · {{ a.grado ?? 'Sin grado' }}
              @if (!a.activo) {
                · <span class="badge-off">Inactivo</span>
              }
            </p>
          </div>
          <button class="btn-ghost btn-sm" (click)="sel.set(null)">Cerrar</button>
        </div>

        <div class="grid gap-3 sm:grid-cols-4">
          <div>
            <label class="label" for="en">Nombres</label>
            <input id="en" class="input" maxlength="100" [(ngModel)]="ed.nombres" />
          </div>
          <div>
            <label class="label" for="ea">Apellidos</label>
            <input id="ea" class="input" maxlength="100" [(ngModel)]="ed.apellidos" />
          </div>
          <div>
            <label class="label" for="eg">Grado</label>
            <select id="eg" class="input" [(ngModel)]="ed.gradoId">
              <option [ngValue]="null">— Sin grado —</option>
              @for (g of grados(); track g.id) {
                <option [ngValue]="g.id">{{ g.nombre }}</option>
              }
            </select>
          </div>
          <div class="flex items-end gap-2">
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" [(ngModel)]="ed.activo" /> Activo
            </label>
            <button
              class="btn-primary btn-sm ml-auto"
              [disabled]="!ed.nombres.trim()"
              (click)="guardar()"
            >
              Guardar
            </button>
          </div>
        </div>

        <div>
          <p class="mb-1 text-sm font-medium">Padres / encargados</p>
          @for (e of a.encargados; track e.personaId) {
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="min-w-48 flex-1"
                >{{ e.nombre }} <span class="muted">· {{ parentesco(e.parentesco) }}</span></span
              >
              <span class="muted">{{ e.telefono ?? '' }} {{ e.correo ?? '' }}</span>
              <button class="btn-ghost btn-sm" (click)="desvincular(e.personaId)">Quitar</button>
            </div>
          } @empty {
            <p class="muted text-sm">Sin encargados vinculados.</p>
          }
          <div class="relative mt-2 flex flex-wrap gap-2">
            <input
              class="input w-64"
              placeholder="Vincular otro encargado (buscar)…"
              aria-label="Buscar encargado"
              [ngModel]="qEnc()"
              (ngModelChange)="buscarEncargado($event)"
            />
            <select class="input w-36" aria-label="Parentesco" [(ngModel)]="parentescoNuevo">
              @for (p of parentescos; track p) {
                <option [value]="p">{{ parentesco(p) }}</option>
              }
            </select>
            @if (resEnc().length) {
              <div
                class="absolute top-full z-10 mt-1 w-64 rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                @for (p of resEnc(); track p.id) {
                  <button
                    class="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    (click)="vincular(p)"
                  >
                    {{ p.nombres }} {{ p.apellidos }} · <span class="font-mono">{{ p.nit }}</span>
                  </button>
                }
              </div>
            }
          </div>
        </div>

        <div>
          <p class="mb-1 text-sm font-medium">Compras y licencias</p>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha</th>
                  <th>Colegio</th>
                  <th>Grado</th>
                  <th>Licencia</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (c of a.compras; track c.ventaId) {
                  <tr [class.line-through]="c.estadoPago === 'ANULADA'">
                    <td>
                      <a
                        class="font-mono text-accent-600 dark:text-accent-400"
                        [routerLink]="['/ventas', c.ventaId]"
                        >{{ c.codigo }}</a
                      >
                    </td>
                    <td>{{ c.fecha | date: 'dd/MM/yyyy' }}</td>
                    <td>{{ c.colegio }}</td>
                    <td>{{ c.grado ?? '—' }}</td>
                    <td class="font-mono">{{ c.licencia ?? '—' }}</td>
                    <td class="money text-right">{{ c.total | quetzal }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="muted py-4 text-center">Sin compras</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Alumno</th>
            <th>Colegio</th>
            <th>Grado</th>
            <th>Padres / encargados</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (a of filas(); track a.id) {
            <tr [class.opacity-60]="!a.activo">
              <td>{{ a.nombre }}</td>
              <td>{{ a.colegio ?? '—' }}</td>
              <td>{{ a.grado ?? '—' }}</td>
              <td class="text-sm">{{ encargadosTexto(a) }}</td>
              <td class="text-right">
                <button class="btn-ghost btn-sm" (click)="abrir(a.id)">Ver</button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="muted py-6 text-center">
                Sin alumnos. Se registran al vender, en el punto de venta.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (total() > filas().length) {
      <div class="mt-3 flex justify-center">
        <button class="btn-secondary btn-sm" (click)="mas()">Ver más</button>
      </div>
    }
  `,
})
export class AlumnosComponent implements OnInit {
  private readonly api = inject(VentasApi);
  private readonly admin = inject(AdminApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly toast = inject(ToastService);

  readonly filas = signal<Alumno[]>([]);
  readonly total = signal(0);
  readonly grados = signal<Grado[]>([]);
  readonly sel = signal<AlumnoDetalle | null>(null);
  readonly qEnc = signal('');
  readonly resEnc = signal<Persona[]>([]);
  readonly parentescos = Object.keys(PARENTESCO);
  parentescoNuevo = 'ENCARGADO';
  ed = { nombres: '', apellidos: '', gradoId: null as number | null, activo: true };
  private q = '';
  private page = 1;
  private timer?: ReturnType<typeof setTimeout>;
  private timerEnc?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.catalogo.grados().subscribe((g) => this.grados.set(g));
    this.cargar();
  }

  private cargar(agregar = false) {
    this.api.alumnos({ q: this.q, page: this.page, limit: 50 }).subscribe({
      next: (r) => {
        this.filas.set(agregar ? [...this.filas(), ...r.data] : r.data);
        this.total.set(r.total);
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
  buscar(q: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q = q.trim();
      this.page = 1;
      this.cargar();
    }, 250);
  }
  mas() {
    this.page++;
    this.cargar(true);
  }
  parentesco(p: string) {
    return PARENTESCO[p] ?? p;
  }
  encargadosTexto(a: Alumno) {
    return a.encargados.map((e) => e.nombre).join(', ') || '—';
  }

  abrir(id: number) {
    this.api.alumno(id).subscribe({
      next: (a) => this.mostrar(a),
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
  private mostrar(a: AlumnoDetalle) {
    this.sel.set(a);
    this.ed = { nombres: a.nombres, apellidos: a.apellidos, gradoId: a.gradoId, activo: a.activo };
    this.qEnc.set('');
    this.resEnc.set([]);
  }
  private refrescar(a: AlumnoDetalle) {
    this.mostrar(a);
    this.filas.update((fs) => fs.map((f) => (f.id === a.id ? a : f)));
  }

  guardar() {
    const a = this.sel();
    if (!a) return;
    this.api
      .editarAlumno(a.id, {
        nombres: this.ed.nombres.trim(),
        apellidos: this.ed.apellidos.trim(),
        ...(this.ed.gradoId ? { gradoId: this.ed.gradoId } : {}),
        activo: this.ed.activo,
      })
      .subscribe({
        next: (x) => {
          this.refrescar(x);
          this.toast.ok('Alumno actualizado');
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }

  buscarEncargado(q: string) {
    this.qEnc.set(q);
    clearTimeout(this.timerEnc);
    if (!q.trim()) {
      this.resEnc.set([]);
      return;
    }
    this.timerEnc = setTimeout(
      () => this.admin.personas(q.trim(), 1, 6).subscribe((r) => this.resEnc.set(r.data)),
      250,
    );
  }
  vincular(p: Persona) {
    const a = this.sel();
    if (!a) return;
    this.api.vincularEncargado(a.id, p.id, this.parentescoNuevo).subscribe({
      next: (x) => {
        this.refrescar(x);
        this.toast.ok(`${p.nombres} vinculado`);
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
  desvincular(personaId: number) {
    const a = this.sel();
    if (!a) return;
    this.api.desvincularEncargado(a.id, personaId).subscribe({
      next: (x) => this.refrescar(x),
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
