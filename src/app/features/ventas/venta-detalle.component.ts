import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { Empresa, ESTADO_LINEA, Venta, VentasApi } from '../../core/ventas/ventas.api';
import { ComprobanteComponent } from './comprobante.component';
import { EnvioCorreoComponent } from './envio-correo.component';

const LICENCIA = /^[A-Za-z0-9][A-Za-z0-9._-]{2,59}$/;

/** Detalle de venta: comprobante, entrega de reservados (CU-10) y anulación (CU-15). */
@Component({
  selector: 'app-venta-detalle',
  imports: [FormsModule, RouterLink, ComprobanteComponent, EnvioCorreoComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
      <a class="btn-ghost btn-sm" routerLink="/ventas">← Ventas</a>
      <div class="flex gap-2">
        <button class="btn-secondary btn-sm" (click)="imprimir()">Imprimir comprobante</button>
        @if (puedeAnular()) {
          <button class="btn-danger btn-sm" (click)="anulando.set(!anulando())">
            Anular venta
          </button>
        }
      </div>
    </div>

    @if (venta(); as v) {
      @if (anulando()) {
        <div class="card mb-4 space-y-3 print:hidden">
          <p class="font-medium">Anular {{ v.codigo }}</p>
          <p class="muted text-sm">
            Se liberan las reservas. El efectivo se reembolsa desde SU turno abierto; lo pagado con
            tarjeta o transferencia se devuelve fuera del sistema.
          </p>
          <input
            class="input"
            maxlength="250"
            placeholder="Motivo (obligatorio)"
            [(ngModel)]="motivo"
          />
          @if (entregados() > 0) {
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" [(ngModel)]="devuelveLibros" />
              El cliente devuelve los {{ entregados() }} libro(s) ya entregados (regresan al
              inventario)
            </label>
          }
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" (click)="anulando.set(false)">Cancelar</button>
            <button
              class="btn-danger"
              [disabled]="!motivo.trim() || procesando()"
              (click)="anular()"
            >
              Confirmar anulación
            </button>
          </div>
        </div>
      }

      @if (reservados().length && v.estadoPago === 'PAGADA') {
        <div class="card mb-4 print:hidden">
          <p class="mb-2 font-medium">Entregar libros reservados</p>
          <table class="table">
            <thead>
              <tr>
                @if (v.alumnos.length) {
                  <th>Alumno</th>
                }
                <th>Libro</th>
                <th class="text-right">Por entregar</th>
                <th class="w-32 text-right">Entregar ahora</th>
              </tr>
            </thead>
            <tbody>
              @for (l of reservados(); track l.id) {
                <tr>
                  @if (v.alumnos.length) {
                    <td>{{ alumnoDe(l.ventaAlumnoId) }}</td>
                  }
                  <td>{{ l.titulo }}</td>
                  <td class="text-right">{{ l.cantidad - l.cantidadEntregada }}</td>
                  <td class="text-right">
                    <input
                      class="input w-20 text-right"
                      type="number"
                      min="0"
                      [max]="l.cantidad - l.cantidadEntregada"
                      [ngModel]="aEntregar()[l.id] || 0"
                      (ngModelChange)="fijar(l.id, $event)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <div class="mt-2 flex justify-end gap-2">
            <button class="btn-secondary btn-sm" (click)="todo()">Todo</button>
            <button
              class="btn-primary btn-sm"
              [disabled]="!hayEntrega() || procesando()"
              (click)="entregar()"
            >
              Registrar entrega
            </button>
          </div>
        </div>
      }

      @if (otrosPendientes().length && v.estadoPago === 'PAGADA') {
        <div class="card mb-4 text-sm print:hidden">
          <p class="mb-1 font-medium">Aún no se pueden entregar</p>
          @for (l of otrosPendientes(); track l.id) {
            <p>
              @if (l.ventaAlumnoId) {
                <span class="muted">{{ alumnoDe(l.ventaAlumnoId) }}:</span>
              }
              {{ l.cantidad }} × {{ l.titulo }} — {{ estado(l.estado)
              }}{{ l.colegioOrigen ? ' desde ' + l.colegioOrigen : '' }}
            </p>
          }
        </div>
      }

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <app-comprobante [venta]="v" [empresa]="empresa()" />
        <div class="space-y-4 print:hidden">
          @if (v.alumnos.length) {
            <div class="card space-y-2 text-sm">
              <p class="font-medium">Alumnos y licencias digitales</p>
              @for (a of v.alumnos; track a.id) {
                <div class="flex flex-wrap items-center gap-2">
                  <span class="min-w-40 flex-1">
                    {{ a.nombre }}
                    @if (a.grado) {
                      <span class="muted">· {{ a.grado }}</span>
                    }
                  </span>
                  @if (editandoLicencia() === a.id) {
                    <input
                      class="input w-48 font-mono uppercase"
                      maxlength="60"
                      aria-label="Licencia"
                      [(ngModel)]="licencia"
                    />
                    <button
                      class="btn-primary btn-sm"
                      [disabled]="procesando() || (!!licencia.trim() && !licenciaValida())"
                      (click)="guardarLicencia(a.id)"
                    >
                      Guardar
                    </button>
                    <button class="btn-ghost btn-sm" (click)="editandoLicencia.set(null)">
                      Cancelar
                    </button>
                  } @else {
                    <span class="font-mono">{{ a.licencia ?? '— sin licencia —' }}</span>
                    @if (v.estadoPago === 'PAGADA') {
                      <button class="btn-ghost btn-sm" (click)="editarLicencia(a.id, a.licencia)">
                        {{ a.licencia ? 'Corregir' : 'Agregar' }}
                      </button>
                    }
                  }
                </div>
              }
            </div>
          }
          <div class="card">
            <app-envio-correo [venta]="v" (actualizada)="venta.set($event)" />
          </div>
        </div>
      </div>
    }
  `,
})
export class VentaDetalleComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(VentasApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  readonly venta = signal<Venta | null>(null);
  readonly empresa = signal<Empresa | null>(null);
  readonly editandoLicencia = signal<number | null>(null);
  licencia = '';
  readonly anulando = signal(false);
  readonly procesando = signal(false);
  readonly aEntregar = signal<Record<number, number>>({});
  motivo = '';
  devuelveLibros = true;

  readonly puedeAnular = computed(
    () => this.auth.tieneRol('ADMIN', 'CONTADOR') && this.venta()?.estadoPago === 'PAGADA',
  );
  readonly reservados = computed(() =>
    (this.venta()?.lineas ?? []).filter((l) => l.estado === 'RESERVADO'),
  );
  readonly otrosPendientes = computed(() =>
    (this.venta()?.lineas ?? []).filter(
      (l) => !['RESERVADO', 'ENTREGADO', 'ANULADO'].includes(l.estado),
    ),
  );
  readonly entregados = computed(() =>
    (this.venta()?.lineas ?? []).reduce((a, l) => a + l.cantidadEntregada, 0),
  );
  readonly hayEntrega = computed(() => Object.values(this.aEntregar()).some((q) => q > 0));

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.api.comprobante(Number(this.id())).subscribe({
      next: ({ venta, empresa }) => {
        this.venta.set(venta);
        this.empresa.set(empresa);
        this.aEntregar.set({});
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  alumnoDe(ventaAlumnoId: number | null) {
    return this.venta()?.alumnos.find((a) => a.id === ventaAlumnoId)?.nombre ?? '—';
  }

  editarLicencia(id: number, actual: string | null) {
    this.licencia = actual ?? '';
    this.editandoLicencia.set(id);
  }
  licenciaValida() {
    return LICENCIA.test(this.licencia.trim());
  }
  guardarLicencia(ventaAlumnoId: number) {
    this.procesando.set(true);
    const l = this.licencia.trim().toUpperCase();
    this.api.editarLicencia(Number(this.id()), ventaAlumnoId, l || null).subscribe({
      next: (v) => {
        this.procesando.set(false);
        this.venta.set(v);
        this.editandoLicencia.set(null);
        this.toast.ok('Licencia actualizada');
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.error(mensajeError(e));
      },
    });
  }

  estado(e: string) {
    return ESTADO_LINEA[e as keyof typeof ESTADO_LINEA]?.texto ?? e;
  }

  fijar(id: number, v: number) {
    this.aEntregar.update((a) => ({ ...a, [id]: Math.max(0, Math.floor(Number(v) || 0)) }));
  }

  todo() {
    this.aEntregar.set(
      Object.fromEntries(this.reservados().map((l) => [l.id, l.cantidad - l.cantidadEntregada])),
    );
  }

  entregar() {
    const lineas = Object.entries(this.aEntregar())
      .filter(([, q]) => q > 0)
      .map(([id, cantidad]) => ({ detalleId: Number(id), cantidad }));
    this.procesando.set(true);
    this.api.entregar(Number(this.id()), lineas).subscribe({
      next: (v) => {
        this.procesando.set(false);
        this.venta.set(v);
        this.aEntregar.set({});
        this.toast.ok('Entrega registrada');
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.error(mensajeError(e));
      },
    });
  }

  anular() {
    this.procesando.set(true);
    this.api
      .anular(Number(this.id()), {
        motivo: this.motivo.trim(),
        devuelveLibros: this.devuelveLibros,
      })
      .subscribe({
        next: (r) => {
          this.procesando.set(false);
          this.anulando.set(false);
          this.venta.set(r.venta);
          const extra =
            r.reembolsoOtrosMedios !== '0.00'
              ? ` Devuelva Q${r.reembolsoOtrosMedios} por tarjeta/transferencia fuera del sistema.`
              : '';
          this.toast.ok(`Venta anulada. Reembolso en efectivo: Q${r.reembolsoEfectivo}.${extra}`);
        },
        error: (e) => {
          this.procesando.set(false);
          this.toast.error(mensajeError(e));
        },
      });
  }

  imprimir() {
    window.print();
  }
}
