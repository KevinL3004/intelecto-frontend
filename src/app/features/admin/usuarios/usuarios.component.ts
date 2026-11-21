import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { Rol, ROL_LABEL } from '../../../core/auth/auth.models';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { AdminApi, UsuarioAdmin } from '../../../core/admin/admin.api';
import { Colegio, ColegiosService } from '../colegios/colegios.service';

const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/** Usuarios del sistema. Admin administra; Contador solo consulta. */
@Component({
    selector: 'app-usuarios',
    imports: [ReactiveFormsModule, DatePipe],
    template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Usuarios</h1>
        <p class="muted">{{ total() }} registrados</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <select
          class="input w-40"
          aria-label="Rol"
          (change)="filtrarRol($any($event.target).value)"
        >
          <option value="">Todos los roles</option>
          @for (r of roles; track r) {
            <option [value]="r">{{ rolLabel[r] }}</option>
          }
        </select>
        <input
          class="input w-56"
          placeholder="Buscar por usuario o nombre"
          (input)="buscar($any($event.target).value)"
        />
        @if (esAdmin) {
          <button class="btn-primary" (click)="nuevo()">Nuevo</button>
        }
      </div>
    </div>

    @if (panel() === 'form') {
      <form class="card mb-4 grid gap-3 sm:grid-cols-3" [formGroup]="form" (ngSubmit)="guardar()">
        <h2 class="font-medium sm:col-span-3">
          {{ editando() ? 'Editar ' + editando()!.username : 'Nuevo usuario' }}
        </h2>
        <div>
          <label class="label" for="nombres">Nombres</label>
          <input id="nombres" class="input" formControlName="nombres" />
        </div>
        <div>
          <label class="label" for="apellidos">Apellidos</label>
          <input id="apellidos" class="input" formControlName="apellidos" />
        </div>
        <div>
          <label class="label" for="username">Usuario</label>
          <input
            id="username"
            class="input lowercase"
            formControlName="username"
            autocomplete="off"
          />
          @if (form.controls.username.invalid && form.controls.username.touched) {
            <p class="field-error">3 a 50: minúsculas, números, punto o guion bajo</p>
          }
        </div>
        <div>
          <label class="label" for="rol">Rol</label>
          <select id="rol" class="input" formControlName="rol">
            @for (r of roles; track r) {
              <option [value]="r">{{ rolLabel[r] }}</option>
            }
          </select>
        </div>
        <div>
          <label class="label" for="colegio">
            Colegio {{ form.controls.rol.value === 'CAJERO' ? '(obligatorio)' : '(opcional)' }}
          </label>
          <select id="colegio" class="input" formControlName="colegioId">
            <option [ngValue]="null">— Ninguno —</option>
            @for (c of colegios(); track c.id) {
              <option [ngValue]="c.id">{{ c.nombre }}</option>
            }
          </select>
        </div>
        @if (!editando()) {
          <div>
            <label class="label" for="password">Contraseña temporal</label>
            <input
              id="password"
              class="input"
              type="text"
              formControlName="password"
              autocomplete="new-password"
            />
            <p class="muted mt-1 text-xs">
              8+ caracteres, mayúscula, minúscula y número. Se pedirá cambiarla al entrar.
            </p>
          </div>
        }
        <div class="flex justify-end gap-2 sm:col-span-3">
          <button type="button" class="btn-secondary" (click)="panel.set(null)">Cancelar</button>
          <button class="btn-primary" [disabled]="invalido() || guardando()">
            {{ editando() ? 'Guardar cambios' : 'Crear usuario' }}
          </button>
        </div>
      </form>
    }

    @if (panel() === 'password') {
      <div class="card mb-4 flex flex-wrap items-end gap-3">
        <div class="min-w-64 flex-1">
          <label class="label" for="np"
            >Nueva contraseña temporal para {{ editando()?.username }}</label
          >
          <input
            id="np"
            class="input"
            type="text"
            autocomplete="new-password"
            [value]="nuevaPassword()"
            (input)="nuevaPassword.set($any($event.target).value)"
          />
          <p class="muted mt-1 text-xs">Desbloquea al usuario y le pedirá cambiarla al entrar.</p>
        </div>
        <button class="btn-secondary" (click)="panel.set(null)">Cancelar</button>
        <button
          class="btn-primary"
          [disabled]="!passwordValida(nuevaPassword())"
          (click)="resetear()"
        >
          Restablecer
        </button>
      </div>
    }

    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Colegio</th>
            <th>Último acceso</th>
            <th>Estado</th>
            @if (esAdmin) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (u of items(); track u.id) {
            <tr>
              <td class="font-mono text-xs">{{ u.username }}</td>
              <td>{{ u.persona.nombres }} {{ u.persona.apellidos }}</td>
              <td>{{ rolLabel[u.rol] }}</td>
              <td>{{ u.colegio?.nombre || '—' }}</td>
              <td class="whitespace-nowrap">
                {{ u.ultimoAcceso ? (u.ultimoAcceso | date: 'dd/MM/yyyy HH:mm') : 'Nunca' }}
              </td>
              <td class="whitespace-nowrap">
                @if (!u.activo) {
                  <span class="badge-off">Inactivo</span>
                } @else if (bloqueado(u)) {
                  <span class="badge-warn">Bloqueado</span>
                } @else if (u.debeCambiarPassword) {
                  <span class="badge-warn">Clave temporal</span>
                } @else {
                  <span class="badge-ok">Activo</span>
                }
              </td>
              @if (esAdmin) {
                <td class="whitespace-nowrap text-right">
                  <button class="btn-ghost btn-sm" (click)="editar(u)">Editar</button>
                  <button class="btn-ghost btn-sm" (click)="abrirPassword(u)">Contraseña</button>
                  @if (u.id !== miId) {
                    @if (u.activo) {
                      <button
                        class="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                        (click)="cambiarEstado(u, false)"
                      >
                        Desactivar
                      </button>
                    } @else {
                      <button class="btn-ghost btn-sm" (click)="cambiarEstado(u, true)">
                        Activar
                      </button>
                    }
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
  `
})
export class UsuariosComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly colegiosService = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  readonly esAdmin = this.auth.tieneRol('ADMIN');
  readonly miId = this.auth.usuario()?.id;
  readonly roles: Rol[] = ['ADMIN', 'CONTADOR', 'CAJERO'];
  readonly rolLabel = ROL_LABEL;

  readonly items = signal<UsuarioAdmin[]>([]);
  readonly total = signal(0);
  readonly colegios = signal<Colegio[]>([]);
  readonly panel = signal<'form' | 'password' | null>(null);
  readonly editando = signal<UsuarioAdmin | null>(null);
  readonly guardando = signal(false);
  readonly nuevaPassword = signal('');
  private q = '';
  private rol: Rol | '' = '';
  private timer?: ReturnType<typeof setTimeout>;

  readonly form = inject(FormBuilder).nonNullable.group({
    nombres: ['', [Validators.required, Validators.maxLength(100)]],
    apellidos: ['', [Validators.maxLength(100)]],
    username: ['', [Validators.required, Validators.pattern(/^[a-z0-9._]{3,50}$/)]],
    rol: ['CAJERO' as Rol, Validators.required],
    colegioId: [null as number | null],
    password: [''],
  });

  ngOnInit() {
    this.cargar();
    this.colegiosService
      .listar('', 1, 200)
      .subscribe((r) => this.colegios.set(r.data.filter((c) => c.activo)));
  }

  cargar() {
    this.api.usuarios(this.q, this.rol, 1, 200).subscribe({
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

  filtrarRol(r: Rol | '') {
    this.rol = r;
    this.cargar();
  }

  bloqueado(u: UsuarioAdmin) {
    return !!u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();
  }

  passwordValida(p: string) {
    return PASSWORD.test(p);
  }

  invalido() {
    const v = this.form.getRawValue();
    if (this.form.invalid) return true;
    if (v.rol === 'CAJERO' && !v.colegioId) return true;
    return !this.editando() && !PASSWORD.test(v.password);
  }

  nuevo() {
    this.editando.set(null);
    this.form.reset({ rol: 'CAJERO', colegioId: null });
    this.form.controls.username.enable();
    this.panel.set('form');
  }

  editar(u: UsuarioAdmin) {
    this.editando.set(u);
    this.form.reset({
      nombres: u.persona.nombres,
      apellidos: u.persona.apellidos,
      username: u.username,
      rol: u.rol,
      colegioId: u.colegioId,
      password: '',
    });
    this.form.controls.username.disable();
    this.panel.set('form');
  }

  guardar() {
    if (this.invalido()) return;
    const v = this.form.getRawValue();
    const persona = { nombres: v.nombres.trim(), apellidos: v.apellidos.trim() };
    const actual = this.editando();
    this.guardando.set(true);
    const fin = {
      next: () => {
        this.toast.ok(actual ? 'Usuario actualizado' : `Usuario ${v.username} creado`);
        this.guardando.set(false);
        this.panel.set(null);
        this.cargar();
      },
      error: (e: unknown) => {
        this.toast.error(mensajeError(e));
        this.guardando.set(false);
      },
    };
    if (!actual) {
      this.api
        .crearUsuario({
          persona,
          username: v.username,
          password: v.password,
          rol: v.rol,
          colegioId: v.colegioId,
        })
        .subscribe(fin);
      return;
    }
    // Primero el usuario (rol/colegio), luego los datos de la persona si cambiaron.
    this.api.editarUsuario(actual.id, { rol: v.rol, colegioId: v.colegioId }).subscribe({
      next: () => {
        const cambioPersona =
          persona.nombres !== actual.persona.nombres ||
          persona.apellidos !== actual.persona.apellidos;
        if (cambioPersona) this.api.editarPersona(actual.personaId, persona).subscribe(fin);
        else fin.next();
      },
      error: fin.error,
    });
  }

  abrirPassword(u: UsuarioAdmin) {
    this.editando.set(u);
    this.nuevaPassword.set('');
    this.panel.set('password');
  }

  resetear() {
    const u = this.editando();
    if (!u) return;
    this.api.resetPassword(u.id, this.nuevaPassword()).subscribe({
      next: () => {
        this.toast.ok(`Contraseña de ${u.username} restablecida`);
        this.panel.set(null);
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  cambiarEstado(u: UsuarioAdmin, activo: boolean) {
    if (!activo && !confirm(`¿Desactivar a ${u.username}? No podrá iniciar sesión.`)) return;
    this.api.editarUsuario(u.id, { activo }).subscribe({
      next: () => {
        this.toast.ok(activo ? 'Usuario activado' : 'Usuario desactivado');
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
