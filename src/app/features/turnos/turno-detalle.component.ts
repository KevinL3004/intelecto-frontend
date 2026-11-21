import { QuetzalPipe } from '../../shared/quetzal.pipe';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import {
  Acta,
  Conteo,
  Denominacion,
  ResultadoCierre,
  VentasApi,
} from '../../core/ventas/ventas.api';
import { ConteoComponent } from '../../shared/conteo.component';
import { ActaComponent } from './acta.component';

/**
 * Detalle de turno para supervisión: validar u observar el cierre (Contador, CU-11),
 * retiros/ingresos de efectivo y cierre forzado (Admin/Contador).
 */
@Component({
    selector: 'app-turno-detalle',
    imports: [QuetzalPipe, FormsModule, RouterLink, ConteoComponent, ActaComponent],
    template: `
    <div class="mb-4 flex items-center justify-between print:hidden">
      <a class="btn-ghost btn-sm" routerLink="/turnos">← Turnos</a>
      <button class="btn-secondary btn-sm" (click)="imprimir()">Imprimir acta</button>
    </div>
    @if (acta(); as a) {
      @if (esSupervisor && (a.estado === 'CERRADO' || a.estado === 'OBSERVADO')) {
        <div class="card mb-4 space-y-2 print:hidden">
          <p class="font-medium">Validar cierre</p>
          <p class="muted text-sm">
            Confirme que recibió Q{{ a.resumen.efectivoAEntregar }} en efectivo y concilió tarjetas
            y transferencias.
          </p>
          <input
            class="input"
            maxlength="250"
            placeholder="Observación (obligatoria si queda observado)"
            [(ngModel)]="obsValidacion"
          />
          <div class="flex justify-end gap-2">
            <button
              class="btn-danger"
              [disabled]="!obsValidacion.trim()"
              (click)="validar('OBSERVADO')"
            >
              Marcar observado
            </button>
            <button class="btn-primary" (click)="validar('VALIDADO')">Validar</button>
          </div>
        </div>
      }

      @if (esSupervisor && a.estado === 'ABIERTO') {
        <div class="card mb-4 flex flex-wrap items-end gap-2 print:hidden">
          <div>
            <label class="label" for="tipo">Movimiento de efectivo</label>
            <select id="tipo" class="input w-36" [(ngModel)]="mov.tipo">
              <option value="RETIRO">Retiro</option>
              <option value="INGRESO">Ingreso</option>
            </select>
          </div>
          <div>
            <label class="label" for="monto">Monto (Q)</label>
            <input
              id="monto"
              class="input w-28 text-right"
              inputmode="decimal"
              [(ngModel)]="mov.monto"
            />
          </div>
          <div class="min-w-48 flex-1">
            <label class="label" for="motivo">Motivo</label>
            <input id="motivo" class="input" maxlength="250" [(ngModel)]="mov.motivo" />
          </div>
          <button
            class="btn-primary"
            [disabled]="!mov.monto || !mov.motivo.trim()"
            (click)="registrarMovimiento()"
          >
            Registrar
          </button>
        </div>
      }

      @if (esSupervisor && esAjeno() && (a.estado === 'ABIERTO' || a.estado === 'EN_CIERRE')) {
        <div class="card mb-4 space-y-3 print:hidden">
          <p class="font-medium">Cierre forzado</p>
          @if (!forzando()) {
            <p class="muted text-sm">
              Úselo si el cajero se fue sin cerrar. Requiere contar el efectivo de la caja y una
              observación.
            </p>
            <div class="flex justify-end">
              <button class="btn-danger" (click)="iniciarForzado()">Cerrar este turno</button>
            </div>
          } @else if (pendiente()) {
            @let p = pendiente()!;
            <p class="text-sm">
              Contado Q{{ p.efectivoContado }} · esperado Q{{ p.efectivoEsperado }} · diferencia
              <strong>{{ p.diferencia | quetzal }}</strong>
            </p>
            <input
              class="input"
              maxlength="250"
              placeholder="Observación (obligatoria)"
              [(ngModel)]="obsCierre"
            />
            <div class="flex justify-end">
              <button
                class="btn-danger"
                [disabled]="!obsCierre.trim()"
                (click)="enviarCierre({ observacion: obsCierre.trim() })"
              >
                Cerrar turno
              </button>
            </div>
          } @else {
            <app-conteo [denominaciones]="denominaciones()" (cambio)="conteo = $event.conteo" />
            <div class="flex justify-end">
              <button class="btn-danger" (click)="enviarCierre({ conteo })">
                Registrar conteo
              </button>
            </div>
          }
        </div>
      }

      <app-acta [acta]="a" />
    }
  `
})
export class TurnoDetalleComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(VentasApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  readonly esSupervisor = this.auth.tieneRol('ADMIN', 'CONTADOR');
  readonly acta = signal<Acta | null>(null);
  readonly denominaciones = signal<Denominacion[]>([]);
  readonly forzando = signal(false);
  readonly pendiente = signal<ResultadoCierre | null>(null);
  obsValidacion = '';
  obsCierre = '';
  conteo: Conteo[] = [];
  mov = { tipo: 'RETIRO' as 'RETIRO' | 'INGRESO', monto: '', motivo: '' };

  ngOnInit() {
    this.cargar();
  }

  esAjeno() {
    return this.acta()?.username !== this.auth.usuario()?.username;
  }

  cargar() {
    this.api.acta(Number(this.id())).subscribe({
      next: (a) => this.acta.set(a),
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  validar(resultado: 'VALIDADO' | 'OBSERVADO') {
    this.api
      .validar(Number(this.id()), {
        resultado,
        observacion: this.obsValidacion.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.toast.ok(
            resultado === 'VALIDADO' ? 'Cierre validado' : 'Cierre marcado como observado',
          );
          this.cargar();
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }

  registrarMovimiento() {
    this.api
      .movimientoCaja(Number(this.id()), { ...this.mov, motivo: this.mov.motivo.trim() })
      .subscribe({
        next: () => {
          this.toast.ok(this.mov.tipo === 'RETIRO' ? 'Retiro registrado' : 'Ingreso registrado');
          this.mov = { tipo: 'RETIRO', monto: '', motivo: '' };
          this.cargar();
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }

  iniciarForzado() {
    if (!confirm('¿Cerrar el turno de otro usuario? Quedará marcado como cierre forzado.')) return;
    const a = this.acta();
    if (!a) return;
    this.api.denominaciones().subscribe((d) => this.denominaciones.set(d));
    const seguir = () => {
      this.forzando.set(true);
      // Si el conteo ya estaba registrado, se pide directo la observación.
      this.enviarCierre({});
    };
    if (a.estado === 'ABIERTO')
      this.api
        .iniciarCierre(a.id)
        .subscribe({ next: seguir, error: (e) => this.toast.error(mensajeError(e)) });
    else seguir();
  }

  enviarCierre(dto: { conteo?: Conteo[]; observacion?: string }) {
    this.api.cerrar(Number(this.id()), dto).subscribe({
      next: (r) => {
        if (r.estado === 'CERRADO') {
          this.toast.ok('Turno cerrado (forzado)');
          this.forzando.set(false);
          this.pendiente.set(null);
          this.cargar();
        } else this.pendiente.set(r);
      },
      error: (e) => {
        // Sin conteo aún: se muestra el formulario de conteo (no es un error para el usuario).
        if (e?.error?.error !== 'CONTEO_REQUERIDO') this.toast.error(mensajeError(e));
      },
    });
  }

  imprimir() {
    window.print();
  }
}
