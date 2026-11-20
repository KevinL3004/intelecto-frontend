import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { AdminApi, Caja } from '../../../core/admin/admin.api';
import { Colegio, ColegiosService } from '../colegios/colegios.service';

const MONTO = /^\d{1,10}(\.\d{1,2})?$/;

/** Cajas por colegio con su fondo (sencillo) asignado. Admin administra; Contador consulta. */
@Component({
  selector: 'app-cajas',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Cajas</h1>
        <p class="muted">{{ visibles().length }} cajas</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <select
          class="input w-56"
          aria-label="Filtrar por colegio"
          (change)="filtro.set(+$any($event.target).value || null)"
        >
          <option value="">Todos los colegios</option>
          @for (c of colegios(); track c.id) {
            <option [value]="c.id">{{ c.nombre }}</option>
          }
        </select>
        @if (esAdmin) {
          <button class="btn-primary" (click)="nuevo()">Nueva</button>
        }
      </div>
    </div>

    @if (panel()) {
      <form class="card mb-4 grid gap-3 sm:grid-cols-3" [formGroup]="form" (ngSubmit)="guardar()">
        <div>
          <label class="label" for="colegio">Colegio</label>
          @if (editando()) {
            <input id="colegio" class="input" [value]="editando()!.colegio.nombre" disabled />
          } @else {
            <select id="colegio" class="input" formControlName="colegioId">
              @for (c of colegios(); track c.id) {
                <option [ngValue]="c.id">{{ c.nombre }}</option>
              }
            </select>
          }
        </div>
        <div>
          <label class="label" for="numero">Número de caja</label>
          <input
            id="numero"
            class="input"
            type="number"
            min="1"
            max="99"
            formControlName="numero"
          />
        </div>
        <div>
          <label class="label" for="fondo">Fondo asignado (Q)</label>
          <input
            id="fondo"
            class="input text-right"
            inputmode="decimal"
            formControlName="fondoAsignado"
          />
          @if (form.controls.fondoAsignado.invalid) {
            <p class="field-error">Monto inválido (máximo 2 decimales)</p>
          }
        </div>
        <div class="flex justify-end gap-2 sm:col-span-3">
          <button type="button" class="btn-secondary" (click)="panel.set(false)">Cancelar</button>
          <button class="btn-primary" [disabled]="form.invalid || guardando()">
            {{ editando() ? 'Guardar cambios' : 'Crear caja' }}
          </button>
        </div>
      </form>
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Colegio</th>
            <th>Caja</th>
            <th class="text-right">Fondo (Q)</th>
            <th>Estado</th>
            @if (esAdmin) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (c of visibles(); track c.id) {
            <tr>
              <td>{{ c.colegio.nombre }}</td>
              <td>Caja {{ c.numero }}</td>
              <td class="money text-right">{{ c.fondoAsignado }}</td>
              <td>
                <span [class]="c.activa ? 'badge-ok' : 'badge-off'">{{
                  c.activa ? 'Activa' : 'Inactiva'
                }}</span>
              </td>
              @if (esAdmin) {
                <td class="whitespace-nowrap text-right">
                  <button class="btn-ghost btn-sm" (click)="editar(c)">Editar</button>
                  @if (c.activa) {
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
              <td colspan="5" class="py-8 text-center muted">Sin cajas</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class CajasComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly colegiosService = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');

  readonly items = signal<Caja[]>([]);
  readonly colegios = signal<Colegio[]>([]);
  readonly filtro = signal<number | null>(null);
  readonly panel = signal(false);
  readonly editando = signal<Caja | null>(null);
  readonly guardando = signal(false);

  readonly visibles = computed(() => {
    const f = this.filtro();
    return f ? this.items().filter((c) => c.colegioId === f) : this.items();
  });

  readonly form = inject(FormBuilder).nonNullable.group({
    colegioId: [null as number | null, Validators.required],
    numero: [1, [Validators.required, Validators.min(1), Validators.max(99)]],
    fondoAsignado: ['0.00', [Validators.required, Validators.pattern(MONTO)]],
  });

  ngOnInit() {
    this.cargar();
    this.colegiosService
      .listar('', 1, 200)
      .subscribe((r) => this.colegios.set(r.data.filter((c) => c.activo)));
  }

  cargar() {
    this.api.cajas().subscribe({
      next: (r) => this.items.set(r),
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  /** Sugiere el siguiente número libre del colegio. */
  private siguienteNumero(colegioId: number | null) {
    const usados = this.items()
      .filter((c) => c.colegioId === colegioId)
      .map((c) => c.numero);
    return usados.length ? Math.max(...usados) + 1 : 1;
  }

  nuevo() {
    this.editando.set(null);
    const colegioId = this.filtro() ?? this.colegios()[0]?.id ?? null;
    this.form.reset({ colegioId, numero: this.siguienteNumero(colegioId), fondoAsignado: '0.00' });
    this.form.controls.colegioId.enable();
    this.panel.set(true);
  }

  editar(c: Caja) {
    this.editando.set(c);
    this.form.reset({ colegioId: c.colegioId, numero: c.numero, fondoAsignado: c.fondoAsignado });
    this.form.controls.colegioId.disable();
    this.panel.set(true);
  }

  guardar() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const actual = this.editando();
    this.guardando.set(true);
    const req = actual
      ? this.api.editarCaja(actual.id, { numero: v.numero, fondoAsignado: v.fondoAsignado })
      : this.api.crearCaja({
          colegioId: v.colegioId!,
          numero: v.numero,
          fondoAsignado: v.fondoAsignado,
        });
    req.subscribe({
      next: () => {
        this.toast.ok(actual ? 'Caja actualizada' : 'Caja creada');
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

  eliminar(c: Caja) {
    if (
      !confirm(
        `¿Eliminar la caja ${c.numero} de ${c.colegio.nombre}? Si tiene turnos solo se desactivará.`,
      )
    )
      return;
    this.api.eliminarCaja(c.id).subscribe({
      next: (r) => {
        this.toast.ok(
          r.resultado === 'ELIMINADO' ? 'Caja eliminada' : 'Caja desactivada (tiene historial)',
        );
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  activar(c: Caja) {
    this.api.editarCaja(c.id, { activa: true }).subscribe({
      next: () => {
        this.toast.ok('Caja activada');
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
