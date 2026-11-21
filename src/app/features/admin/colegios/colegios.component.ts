import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { Colegio, ColegiosService } from './colegios.service';

/**
 * Patrón estándar de mantenimiento (CRUD): buscador, tabla, panel de formulario y confirmación.
 * Copiar este componente como base para los demás catálogos.
 */
@Component({
  selector: 'app-colegios',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Colegios</h1>
        <p class="muted">{{ total() }} registrados</p>
      </div>
      <div class="flex gap-2">
        <input
          class="input w-56"
          placeholder="Buscar por nombre o código"
          (input)="buscar($any($event.target).value)"
        />
        @if (esAdmin) {
          <button class="btn-primary" (click)="nuevo()">Nuevo</button>
        }
      </div>
    </div>

    @if (panel()) {
      <form class="card mb-4 grid gap-3 sm:grid-cols-2" [formGroup]="form" (ngSubmit)="guardar()">
        <div>
          <label class="label" for="codigo">Código</label>
          <input
            id="codigo"
            class="input uppercase"
            formControlName="codigo"
            placeholder="COL-001"
          />
        </div>
        <div>
          <label class="label" for="nombre">Nombre</label>
          <input id="nombre" class="input" formControlName="nombre" />
        </div>
        <div>
          <label class="label" for="direccion">Dirección</label>
          <input id="direccion" class="input" formControlName="direccion" />
        </div>
        <div>
          <label class="label" for="telefono">Teléfono</label>
          <input id="telefono" class="input" formControlName="telefono" />
        </div>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <button type="button" class="btn-secondary" (click)="panel.set(false)">Cancelar</button>
          <button class="btn-primary" [disabled]="form.invalid || guardando()">
            {{ editando() ? 'Guardar cambios' : 'Crear' }}
          </button>
        </div>
      </form>
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Estado</th>
            @if (esAdmin) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (c of items(); track c.id) {
            <tr>
              <td class="font-mono text-xs">{{ c.codigo }}</td>
              <td>{{ c.nombre }}</td>
              <td>{{ c.telefono || '—' }}</td>
              <td>
                <span [class]="c.activo ? 'badge-ok' : 'badge-off'">{{
                  c.activo ? 'Activo' : 'Inactivo'
                }}</span>
              </td>
              @if (esAdmin) {
                <td class="text-right">
                  <button class="btn-ghost btn-sm" (click)="editar(c)">Editar</button>
                  @if (c.activo) {
                    <button
                      class="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                      (click)="eliminar(c)"
                    >
                      Eliminar
                    </button>
                  } @else {
                    <button class="btn-ghost btn-sm" (click)="activar(c)">Activar</button>
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="py-8 text-center muted">Sin registros</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ColegiosComponent implements OnInit {
  private readonly service = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');

  readonly items = signal<Colegio[]>([]);
  readonly total = signal(0);
  readonly panel = signal(false);
  readonly editando = signal<Colegio | null>(null);
  readonly guardando = signal(false);
  private q = '';
  private timer?: ReturnType<typeof setTimeout>;

  readonly form = inject(FormBuilder).nonNullable.group({
    codigo: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{2,20}$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    direccion: [''],
    telefono: [''],
  });

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.service.listar(this.q).subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.total.set(r.total);
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

  nuevo() {
    this.editando.set(null);
    this.form.reset();
    this.panel.set(true);
  }

  editar(c: Colegio) {
    this.editando.set(c);
    this.form.reset({
      codigo: c.codigo,
      nombre: c.nombre,
      direccion: c.direccion ?? '',
      telefono: c.telefono ?? '',
    });
    this.panel.set(true);
  }

  guardar() {
    if (this.form.invalid) return;
    this.guardando.set(true);
    const v = this.form.getRawValue();
    const dto = { ...v, direccion: v.direccion || undefined, telefono: v.telefono || undefined };
    const actual = this.editando();
    const req = actual ? this.service.editar(actual.id, dto) : this.service.crear(dto);
    req.subscribe({
      next: () => {
        this.toast.ok(actual ? 'Colegio actualizado' : 'Colegio creado');
        this.panel.set(false);
        this.guardando.set(false);
        this.cargar();
      },
      error: (e) => {
        this.toast.error(mensajeError(e));
        this.guardando.set(false);
      },
    });
  }

  eliminar(c: Colegio) {
    if (!confirm(`¿Eliminar el colegio "${c.nombre}"? Si tiene historial solo se desactivará.`))
      return;
    this.service.eliminar(c.id).subscribe({
      next: (r) => {
        this.toast.ok(
          r.resultado === 'ELIMINADO'
            ? 'Colegio eliminado'
            : 'Colegio desactivado (tiene historial)',
        );
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  activar(c: Colegio) {
    this.service.editar(c.id, { activo: true }).subscribe({
      next: () => {
        this.toast.ok('Colegio activado');
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
