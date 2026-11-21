import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';
import { CatalogoApi, Libro } from '../../../core/catalogo/catalogo.api';

@Component({
    selector: 'app-libros',
    imports: [ReactiveFormsModule],
    template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Libros</h1>
        <p class="muted">{{ total() }} registrados</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <input
          class="input w-64"
          placeholder="Buscar por título, ISBN o editorial"
          (input)="buscar($any($event.target).value)"
        />
        @if (esAdmin) {
          <button class="btn-primary" (click)="nuevo()">Nuevo</button>
        }
      </div>
    </div>

    @if (panel()) {
      <form class="card mb-4 grid gap-3 sm:grid-cols-3" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="sm:col-span-3">
          <label class="label" for="titulo">Título</label>
          <input id="titulo" class="input" formControlName="titulo" />
        </div>
        <div>
          <label class="label" for="isbn">ISBN (opcional)</label>
          <input id="isbn" class="input font-mono" formControlName="isbn" placeholder="978-…" />
          @if (form.controls.isbn.invalid && form.controls.isbn.touched) {
            <p class="field-error">10 a 20 dígitos, guiones o X</p>
          }
        </div>
        <div class="sm:col-span-2">
          <label class="label" for="editorial">Editorial (opcional)</label>
          <input id="editorial" class="input" formControlName="editorial" />
        </div>
        <div class="flex justify-end gap-2 sm:col-span-3">
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
            <th>Título</th>
            <th>ISBN</th>
            <th>Editorial</th>
            <th>Estado</th>
            @if (esAdmin) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (l of items(); track l.id) {
            <tr>
              <td>{{ l.titulo }}</td>
              <td class="font-mono text-xs">{{ l.isbn || '—' }}</td>
              <td>{{ l.editorial || '—' }}</td>
              <td>
                <span [class]="l.activo ? 'badge-ok' : 'badge-off'">{{
                  l.activo ? 'Activo' : 'Inactivo'
                }}</span>
              </td>
              @if (esAdmin) {
                <td class="whitespace-nowrap text-right">
                  <button class="btn-ghost btn-sm" (click)="editar(l)">Editar</button>
                  @if (l.activo) {
                    <button
                      class="btn-ghost btn-sm text-rose-600 dark:text-rose-400"
                      (click)="eliminar(l)"
                    >
                      Eliminar
                    </button>
                  } @else {
                    <button class="btn-ghost btn-sm" (click)="activar(l)">Activar</button>
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
  `
})
export class LibrosComponent implements OnInit {
  private readonly api = inject(CatalogoApi);
  private readonly toast = inject(ToastService);
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');
  readonly limit = 50;

  readonly items = signal<Libro[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly panel = signal(false);
  readonly editando = signal<Libro | null>(null);
  readonly guardando = signal(false);
  private q = '';
  private timer?: ReturnType<typeof setTimeout>;

  readonly form = inject(FormBuilder).nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(200)]],
    isbn: ['', [Validators.pattern(/^[0-9Xx\s-]{10,20}$/)]],
    editorial: ['', [Validators.maxLength(120)]],
  });

  paginas() {
    return Math.max(1, Math.ceil(this.total() / this.limit));
  }

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.api.libros(this.q, this.page(), this.limit).subscribe({
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
    this.form.reset();
    this.panel.set(true);
  }

  editar(l: Libro) {
    this.editando.set(l);
    this.form.reset({ titulo: l.titulo, isbn: l.isbn ?? '', editorial: l.editorial ?? '' });
    this.panel.set(true);
  }

  guardar() {
    if (this.form.invalid) return;
    this.guardando.set(true);
    const v = this.form.getRawValue();
    const dto = {
      titulo: v.titulo.trim(),
      isbn: v.isbn.trim() || null,
      editorial: v.editorial.trim() || null,
    };
    const actual = this.editando();
    const req = actual ? this.api.editarLibro(actual.id, dto) : this.api.crearLibro(dto);
    req.subscribe({
      next: () => {
        this.toast.ok(actual ? 'Libro actualizado' : 'Libro creado');
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

  eliminar(l: Libro) {
    if (!confirm(`¿Eliminar el libro "${l.titulo}"? Si tiene historial solo se desactivará.`))
      return;
    this.api.eliminarLibro(l.id).subscribe({
      next: (r) => {
        this.toast.ok(
          r.resultado === 'ELIMINADO' ? 'Libro eliminado' : 'Libro desactivado (tiene historial)',
        );
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  activar(l: Libro) {
    this.api.editarLibro(l.id, { activo: true }).subscribe({
      next: () => {
        this.toast.ok('Libro activado');
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
