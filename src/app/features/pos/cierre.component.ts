import { QuetzalPipe } from '../../shared/quetzal.pipe';
import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { ActaComponent } from '../turnos/acta.component';

/**
 * CU-06: cierre de turno con conteo ciego. El cajero cuenta sin ver el esperado; el conteo se
 * registra una sola vez y, si hay diferencia, se pide observación antes de cerrar.
 */
@Component({
  selector: 'app-cierre',
  imports: [QuetzalPipe, FormsModule, RouterLink, ConteoComponent, ActaComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <h1 class="page-title mb-4 print:hidden">Cierre de turno</h1>
    @if (actaFinal(); as a) {
      <app-acta [acta]="a" />
      <div class="mt-4 flex justify-end gap-2 print:hidden">
        <button class="btn-secondary" (click)="imprimir()">Imprimir acta</button>
        <a class="btn-primary" routerLink="/pos">Abrir otro turno</a>
      </div>
    } @else if (!turno()) {
      <div class="card muted">
        No tiene un turno abierto.
        <a class="text-accent-600 underline" routerLink="/pos">Ir al punto de venta</a>
      </div>
    } @else if (turno()!.estado === 'ABIERTO') {
      <div class="card space-y-3">
        <p>
          Caja {{ turno()!.cajaNumero }} · {{ turno()!.colegio }}. Al iniciar el cierre ya no podrá
          vender en este turno. Tenga a la mano el efectivo de la caja para contarlo.
        </p>
        <div class="flex justify-end gap-2">
          <a class="btn-secondary" routerLink="/pos">Volver a vender</a>
          <button class="btn-primary" [disabled]="procesando()" (click)="iniciar()">
            Iniciar cierre
          </button>
        </div>
      </div>
    } @else if (pendiente()) {
      @let p = pendiente()!;
      <div class="card space-y-3">
        <p class="font-medium">{{ p.motivo }}</p>
        <div class="grid max-w-sm grid-cols-2 gap-1 text-sm">
          <span>Contado</span><span class="money text-right">Q{{ p.efectivoContado }}</span>
          <span>Esperado</span><span class="money text-right">Q{{ p.efectivoEsperado }}</span>
          <span class="font-medium">Diferencia</span>
          <span
            class="money text-right font-medium"
            [class.text-rose-600]="p.diferencia !== '0.00'"
            >{{ p.diferencia | quetzal }}</span
          >
        </div>
        <p class="muted text-sm">El conteo ya quedó registrado y no se puede cambiar.</p>
        <label class="label" for="obs">Observación (obligatoria)</label>
        <textarea
          id="obs"
          class="input"
          rows="2"
          maxlength="250"
          [(ngModel)]="observacion"
        ></textarea>
        <div class="flex justify-end">
          <button
            class="btn-primary"
            [disabled]="!observacion.trim() || procesando()"
            (click)="cerrar()"
          >
            Cerrar turno
          </button>
        </div>
      </div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-5">
        <div class="card lg:col-span-3">
          <p class="mb-1 font-medium">Cuente el efectivo de la caja</p>
          <p class="muted mb-3 text-sm">
            Incluya el fondo inicial. El sistema no muestra el monto esperado hasta registrar el
            conteo.
          </p>
          <app-conteo
            [denominaciones]="denominaciones()"
            (cambio)="conteo = $event.conteo; total = $event.total"
          />
          <div class="mt-4 flex justify-between gap-2">
            <button class="btn-secondary" [disabled]="procesando()" (click)="cancelar()">
              Cancelar cierre
            </button>
            <button class="btn-primary" [disabled]="procesando()" (click)="registrar()">
              Registrar conteo
            </button>
          </div>
        </div>
        <div class="card lg:col-span-2">
          <p class="mb-2 font-medium">Revise tarjetas y transferencias</p>
          @if (acta(); as a) {
            @for (pg of a.pagos; track pg.id) {
              <div
                class="flex justify-between border-b border-zinc-100 py-1 text-sm dark:border-zinc-900"
              >
                <span
                  >{{ pg.nombre }} ·
                  <span class="font-mono text-xs">{{ pg.referencia }}</span></span
                >
                <span class="money">Q{{ pg.montoTotal }}</span>
              </div>
            } @empty {
              <p class="muted text-sm">Sin pagos con tarjeta ni transferencia.</p>
            }
            <div class="mt-2 flex justify-between text-sm font-medium">
              <span>Tarjeta</span><span class="money">Q{{ a.resumen.tarjeta }}</span>
            </div>
            <div class="flex justify-between text-sm font-medium">
              <span>Transferencia</span><span class="money">Q{{ a.resumen.transferencia }}</span>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class CierreComponent implements OnInit {
  private readonly api = inject(VentasApi);
  private readonly toast = inject(ToastService);
  readonly turno = this.api.turno;
  readonly denominaciones = signal<Denominacion[]>([]);
  readonly acta = signal<Acta | null>(null);
  readonly actaFinal = signal<Acta | null>(null);
  readonly pendiente = signal<ResultadoCierre | null>(null);
  readonly procesando = signal(false);
  conteo: Conteo[] = [];
  total = '0.00';
  observacion = '';

  ngOnInit() {
    this.api.denominaciones().subscribe((d) => this.denominaciones.set(d));
    this.cargar();
  }

  private cargar() {
    this.api.turnoActual().subscribe((r) => {
      const t = r.turno;
      if (!t) return;
      this.api.acta(t.id).subscribe((a) => this.acta.set(a));
      // Recarga a mitad del cierre: el conteo ya está; se pide la observación pendiente.
      if (t.estado === 'EN_CIERRE' && t.conteoRegistrado) this.enviar({});
    });
  }

  iniciar() {
    const t = this.turno();
    if (!t) return;
    this.procesando.set(true);
    this.api.iniciarCierre(t.id).subscribe({
      next: () => {
        this.procesando.set(false);
        this.cargar();
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.error(mensajeError(e));
      },
    });
  }

  cancelar() {
    const t = this.turno();
    if (!t) return;
    this.api.cancelarCierre(t.id).subscribe({
      next: () => {
        this.toast.info('Cierre cancelado: el turno sigue abierto');
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }

  registrar() {
    if (!confirm(`¿Registrar el conteo de Q${this.total}? Una vez registrado no se puede cambiar.`))
      return;
    this.enviar({ conteo: this.conteo });
  }

  cerrar() {
    this.enviar({ observacion: this.observacion.trim() });
  }

  private enviar(dto: { conteo?: Conteo[]; observacion?: string }) {
    const t = this.turno();
    if (!t) return;
    this.procesando.set(true);
    this.api.cerrar(t.id, dto).subscribe({
      next: (r) => {
        this.procesando.set(false);
        if (r.estado === 'CERRADO' && r.acta) {
          this.actaFinal.set(r.acta);
          this.api.turno.set(null);
          this.toast.ok('Turno cerrado. Entregue el efectivo al Contador.');
        } else this.pendiente.set(r);
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
