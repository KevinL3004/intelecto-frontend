import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { LogisticaApi, Proveedor } from '../../core/inventario/logistica.api';

/** Mantenimiento de proveedores (Admin y Contador). */
@Component({
  selector: 'app-proveedores',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <a class="btn-ghost btn-sm mb-1" routerLink="/inventario/pedidos">← Pedidos</a>
        <h1 class="page-title">Proveedores</h1>
      </div>
      <div class="flex gap-2">
        <input
          class="input w-56"
          placeholder="Buscar"
          (input)="buscar($any($event.target).value)"
        />
        <button class="btn-primary" (click)="nuevo()">Nuevo</button>
      </div>
    </div>
    @if (panel()) {
      <form class="card mb-4 grid gap-3 sm:grid-cols-3" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="sm:col-span-2">
          <label class="label" for="nombre">Nombre</label>
          <input id="nombre" class="input" formControlName="nombre" />
        </div>
        <div>
          <label class="label" for="nit">NIT</label>
          <input id="nit" class="input uppercase" formControlName="nit" />
        </div>
        <div>
          <label class="label" for="contacto">Contacto</label>
          <input id="contacto" class="input" formControlName="contacto" />
        </div>
        <div>
          <label class="label" for="tel">Teléfono</label>
          <input id="tel" class="input" formControlName="telefono" />
        </div>
        <div>
          <label class="label" for="correo">Correo</label>
          <input id="correo" class="input" type="email" formControlName="correo" />
        </div>
        <div class="flex justify-end gap-2 sm:col-span-3">
          <button type="button" class="btn-secondary" (click)="panel.set(false)">Cancelar</button>
          <button class="btn-primary" [disabled]="form.invalid">
            {{ editando() ? 'Guardar cambios' : 'Crear' }}
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
            <th>Contacto</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (p of items(); track p.id) {
            <tr>
              <td>{{ p.nombre }}</td>
              <td class="font-mono text-xs">{{ p.nit || '—' }}</td>
              <td>{{ p.contacto || '—' }}</td>
              <td>{{ p.telefono || '—' }}</td>
              <td>{{ p.correo || '—' }}</td>
              <td>
                <span [class]="p.activo ? 'badge-ok' : 'badge-off'">{{
                  p.activo ? 'Activo' : 'Inactivo'
                }}</span>
              </td>
              <td class="whitespace-nowrap text-right">
                <button class="btn-ghost btn-sm" (click)="editar(p)">Editar</button>
                @if (p.activo) {
                  <button
                    class="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                    (click)="eliminar(p)"
                  >
                    Eliminar
                  </button>
                } @else {
                  <button class="btn-ghost btn-sm" (click)="activar(p)">Activar</button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="py-8 text-center muted">Sin proveedores</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ProveedoresComponent implements OnInit {
  private readonly api = inject(LogisticaApi);
  private readonly toast = inject(ToastService);
  readonly items = signal<Proveedor[]>([]);
  readonly panel = signal(false);
  readonly editando = signal<Proveedor | null>(null);
  private q = '';
  private timer?: ReturnType<typeof setTimeout>;

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    nit: ['', [Validators.pattern(/^\s*(CF|cf|\d{1,12}[Kk]?)?\s*$/)]],
    contacto: ['', [Validators.maxLength(150)]],
    telefono: ['', [Validators.pattern(/^([\d+\s-]{8,20})?$/)]],
    correo: ['', [Validators.email]],
  });

  ngOnInit() {
    this.cargar();
  }
  cargar() {
    this.api.proveedores(this.q).subscribe({
      next: (r) => this.items.set(r.data),
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
  editar(p: Proveedor) {
    this.editando.set(p);
    this.form.reset({
      nombre: p.nombre,
      nit: p.nit ?? '',
      contacto: p.contacto ?? '',
      telefono: p.telefono ?? '',
      correo: p.correo ?? '',
    });
    this.panel.set(true);
  }
  guardar() {
    const v = this.form.getRawValue();
    const actual = this.editando();
    const req = actual ? this.api.editarProveedor(actual.id, v) : this.api.crearProveedor(v);
    req.subscribe({
      next: () => {
        this.toast.ok(actual ? 'Proveedor actualizado' : 'Proveedor creado');
        this.panel.set(false);
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
  eliminar(p: Proveedor) {
    if (!confirm(`¿Eliminar a ${p.nombre}? Si tiene pedidos solo se desactivará.`)) return;
    this.api.eliminarProveedor(p.id).subscribe({
      next: (r) => {
        this.toast.ok(
          r.resultado === 'ELIMINADO'
            ? 'Proveedor eliminado'
            : 'Proveedor desactivado (tiene pedidos)',
        );
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
  activar(p: Proveedor) {
    this.api.editarProveedor(p.id, { activo: true }).subscribe({
      next: () => this.cargar(),
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
