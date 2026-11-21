import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { mensajeError } from '../../core/http/api-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex min-h-screen items-center justify-center p-4">
      <form class="card w-full max-w-sm space-y-4 p-6" [formGroup]="form" (ngSubmit)="entrar()">
        <div>
          <p class="text-sm font-semibold tracking-wide">INTELECTO</p>
          <h1 class="page-title">Iniciar sesión</h1>
        </div>
        <div>
          <label class="label" for="u">Usuario</label>
          <input
            id="u"
            class="input"
            formControlName="username"
            autocomplete="username"
            autofocus
          />
        </div>
        <div>
          <label class="label" for="p">Contraseña</label>
          <input
            id="p"
            class="input"
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </div>
        @if (error()) {
          <p class="field-error">{{ error() }}</p>
        }
        <button class="btn-primary w-full" type="submit" [disabled]="form.invalid || cargando()">
          {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
        </button>
        <button type="button" class="btn-ghost btn-sm w-full" (click)="theme.alternar()">
          Cambiar tema
        </button>
      </form>
    </div>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  entrar() {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: (r) => {
        if (r.usuario.tema) this.theme.set(r.usuario.tema, false);
        // CU-01: el cajero entra directo al punto de venta (allí abre turno si no tiene).
        const destino = r.usuario.rol === 'CAJERO' ? '/pos' : '/inicio';
        this.router.navigate([r.usuario.debeCambiarPassword ? '/cambiar-password' : destino]);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
