import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';

const iguales = (g: AbstractControl): ValidationErrors | null =>
  g.get('nueva')?.value === g.get('confirmar')?.value ? null : { distintas: true };

@Component({
    selector: 'app-cambiar-password',
    imports: [ReactiveFormsModule],
    template: `
    <div class="flex min-h-screen items-center justify-center p-4">
      <form class="card w-full max-w-sm space-y-4 p-6" [formGroup]="form" (ngSubmit)="guardar()">
        <div>
          <h1 class="page-title">Cambiar contraseña</h1>
          <p class="muted">Mínimo 8 caracteres, con mayúscula, minúscula y número.</p>
        </div>
        <div>
          <label class="label" for="a">Contraseña actual</label>
          <input
            id="a"
            class="input"
            type="password"
            formControlName="actual"
            autocomplete="current-password"
          />
        </div>
        <div>
          <label class="label" for="n">Nueva contraseña</label>
          <input
            id="n"
            class="input"
            type="password"
            formControlName="nueva"
            autocomplete="new-password"
          />
        </div>
        <div>
          <label class="label" for="c">Confirmar</label>
          <input
            id="c"
            class="input"
            type="password"
            formControlName="confirmar"
            autocomplete="new-password"
          />
          @if (form.errors?.['distintas'] && form.get('confirmar')?.dirty) {
            <p class="field-error">Las contraseñas no coinciden</p>
          }
        </div>
        @if (error()) {
          <p class="field-error">{{ error() }}</p>
        }
        <div class="flex gap-2">
          <button type="button" class="btn-secondary flex-1" (click)="auth.logout()">Salir</button>
          <button class="btn-primary flex-1" type="submit" [disabled]="form.invalid || cargando()">
            Guardar
          </button>
        </div>
      </form>
    </div>
  `
})
export class CambiarPasswordComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      actual: ['', Validators.required],
      nueva: [
        '',
        [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)],
      ],
      confirmar: ['', Validators.required],
    },
    { validators: iguales },
  );

  guardar() {
    if (this.form.invalid) return;
    this.cargando.set(true);
    const { actual, nueva } = this.form.getRawValue();
    this.auth.cambiarPassword(actual, nueva).subscribe({
      next: () => {
        this.toast.ok('Contraseña actualizada');
        this.router.navigate(['/inicio']);
      },
      error: (e) => {
        this.error.set(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }
}
