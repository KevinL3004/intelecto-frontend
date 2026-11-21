import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { AdminApi, Persona, PersonaForm } from '../../../core/admin/admin.api';

/**
 * Personas (clientes y empleados). Todos los roles buscan y registran;
 * solo el Admin edita o elimina.
 */
@Component({
  selector: 'app-personas',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Personas y clientes</h1>
        <p class="muted">{{ total() }} registradas</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <input
          class="input w-64"
          placeholder="Buscar por nombre, NIT o DPI"
          (input)="buscar($any($event.target).value)"
        />
        <button class="btn-primary" (click)="nuevo()">Nueva</button>
      </div>
    </div>

    @if (panel()) {
      <form class="card mb-4 grid gap-3 sm:grid-cols-3" [formGroup]="form" (ngSubmit)="guardar()">
        <div>
          <label class="label" for="nombres">Nombres</label>
          <input id="nombres" class="input" formControlName="nombres" />
        </div>
        <div>
          <label class="label" for="apellidos">Apellidos</label>
          <input id="apellidos" class="input" formControlName="apellidos" />
        </div>
        <div>
          <label class="label" for="nit">NIT</label>
          <input id="nit" class="input uppercase" formControlName="nit" placeholder="CF" />
          @if (form.controls.nit.invalid) {
            <p class="field-error">CF o solo números (K al final si aplica)</p>
          }
        </div>
        <div>
          <label class="label" for="dpi">DPI (opcional)</label>
          <input id="dpi" class="input" inputmode="numeric" formControlName="dpi" />
          @if (form.controls.dpi.invalid) {
            <p class="field-error">13 dígitos</p>
          }
        </div>
        <div>
          <label class="label" for="telefono">Teléfono (opcional)</label>
          <input id="telefono" class="input" inputmode="tel" formControlName="telefono" />
          @if (form.controls.telefono.invalid) {
            <p class="field-error">8 a 20 dígitos</p>
          }
        </div>
        <div>
          <label class="label" for="correo">Correo (opcional)</label>
          <input id="correo" class="input" type="email" formControlName="correo" />
          @if (form.controls.correo.invalid) {
            <p class="field-error">Correo inválido</p>
          }
        </div>
        <div class="flex justify-end gap-2 sm:col-span-3">
          <button type="button" class="btn-secondary" (click)="panel.set(false)">Cancelar</button>
          <button class="btn-primary" [disabled]="form.invalid || guardando()">
            {{ editando() ? 'Guardar cambios' : 'Registrar' }}
          </button>
        </div>
      </form>
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>NIT</th>
            <th>DPI</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Estado</th>
            @if (esAdmin) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (p of items(); track p.id) {
            <tr>
              <td>{{ p.nombres }} {{ p.apellidos }}</td>
              <td class="font-mono text-xs">{{ p.nit }}</td>
              <td class="font-mono text-xs">{{ p.dpi || '—' }}</td>
              <td>{{ p.telefono || '—' }}</td>
              <td>{{ p.correo || '—' }}</td>
              <td>
                <span [class]="p.activo ? 'badge-ok' : 'badge-off'">{{
                  p.activo ? 'Activa' : 'Inactiva'
                }}</span>
              </td>
              @if (esAdmin) {
                <td class="whitespace-nowrap text-right">
                  <button class="btn-ghost btn-sm" (click)="editar(p)">Editar</button>
                  @if (p.activo) {
                    <button
                      class="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                      (click)="eliminar(p)"
                    >
                      Eliminar
                    </button>
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="py-8 text-center muted">Sin registros</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (total() > limit) {
      <div class="mt-3 flex items-center justify-end gap-2">
        <button class="btn-secondary btn-sm" [disabled]="page() === 1" (click)="irA(page() - 1)">
          Anterior
        </button>
        <span class="muted">Página {{ page() }} de {{ paginas() }}</span>
        <button
          class="btn-secondary btn-sm"
          [disabled]="page() >= paginas()"
          (click)="irA(page() + 1)"
        >
          Siguiente
        </button>
      </div>
    }
  `,
})
export class PersonasComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');
  readonly limit = 50;

  readonly items = signal<Persona[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly panel = signal(false);
  readonly editando = signal<Persona | null>(null);
  readonly guardando = signal(false);
  private q = '';
  private timer?: ReturnType<typeof setTimeout>;

  readonly form = inject(FormBuilder).nonNullable.group({
    nombres: ['', [Validators.required, Validators.maxLength(100)]],
    apellidos: ['', [Validators.maxLength(100)]],
    nit: ['CF', [Validators.pattern(/^\s*(CF|cf|\d{1,12}[Kk]?)\s*$/)]],
    dpi: ['', [Validators.pattern(/^\d{13}$/)]],
    telefono: ['', [Validators.pattern(/^[\d+\s-]{8,20}$/)]],
    correo: ['', [Validators.email, Validators.maxLength(120)]],
  });

  paginas() {
    return Math.max(1, Math.ceil(this.total() / this.limit));
  }

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.api.personas(this.q, this.page(), this.limit).subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.total.set(r.total);
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  irA(p: number) {
    this.page.set(p);
    this.cargar();
  }

  buscar(q: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.q = q.trim();
      this.page.set(1);
      this.cargar();
    }, 300);
  }

  nuevo() {
    this.editando.set(null);
    this.form.reset({ nit: 'CF' });
    this.panel.set(true);
  }

  editar(p: Persona) {
    this.editando.set(p);
    this.form.reset({
      nombres: p.nombres,
      apellidos: p.apellidos,
      nit: p.nit,
      dpi: p.dpi ?? '',
      telefono: p.telefono ?? '',
      correo: p.correo ?? '',
    });
    this.panel.set(true);
  }

  guardar() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const dto: PersonaForm = {
      nombres: v.nombres.trim(),
      apellidos: v.apellidos.trim(),
      nit: v.nit.trim() || 'CF',
      // Vacío = quitar el dato (el backend lo guarda como null)
      dpi: v.dpi.trim(),
      telefono: v.telefono.trim(),
      correo: v.correo.trim(),
    };
    const actual = this.editando();
    this.guardando.set(true);
    const req = actual ? this.api.editarPersona(actual.id, dto) : this.api.crearPersona(dto);
    req.subscribe({
      next: () => {
        this.toast.ok(actual ? 'Persona actualizada' : 'Persona registrada');
        this.guardando.set(false);
        this.panel.set(false);
        this.cargar();
      },
      error: (e) => {
        this.toast.error(mensajeError(e));
        this.guardando.set(false);
      },
    });
  }

  eliminar(p: Persona) {
    if (
      !confirm(`¿Eliminar a ${p.nombres} ${p.apellidos}? Si tiene historial solo se desactivará.`)
    )
      return;
    this.api.eliminarPersona(p.id).subscribe({
      next: (r) => {
        this.toast.ok(
          r.resultado === 'ELIMINADO'
            ? 'Persona eliminada'
            : 'Persona desactivada (tiene historial)',
        );
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
