import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { Venta, VentasApi } from '../../core/ventas/ventas.api';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ESTADO = {
  PENDIENTE: { texto: 'Enviando…', clase: 'badge-warn' },
  ENVIADO: { texto: 'Enviado', clase: 'badge-ok' },
  FALLIDO: { texto: 'No se pudo enviar', clase: 'badge-off' },
} as const;

/** Estado de los correos del comprobante y formulario para enviarlo (o reenviarlo). */
@Component({
  selector: 'app-envio-correo',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @let v = venta();
    <div class="space-y-2 text-sm">
      <p class="font-medium">Comprobante por correo</p>
      @for (c of v.correos; track c.id) {
        <p class="flex flex-wrap items-center gap-2">
          <span [class]="estado(c.estado).clase">{{ estado(c.estado).texto }}</span>
          <span class="font-mono text-xs">{{ c.destinatario }}</span>
          @if (c.enviadoEn) {
            <span class="muted text-xs">{{ c.enviadoEn | date: 'dd/MM HH:mm' }}</span>
          }
        </p>
      } @empty {
        <p class="muted">
          {{
            v.clienteCorreo
              ? 'No se ha enviado (el envío de correos puede no estar configurado).'
              : 'El cliente no tiene correo registrado.'
          }}
        </p>
      }
      <div class="flex flex-wrap items-center gap-2">
        <input
          class="input min-w-56 flex-1"
          type="email"
          placeholder="correo@ejemplo.com"
          aria-label="Correo para enviar el comprobante"
          maxlength="120"
          [(ngModel)]="correo"
        />
        <button class="btn-secondary" [disabled]="!valido() || enviando()" (click)="enviar()">
          {{ v.correos.length ? 'Reenviar' : 'Enviar' }}
        </button>
      </div>
      @if (!v.clienteCorreo && valido()) {
        <label class="flex items-center gap-2 text-xs">
          <input type="checkbox" [(ngModel)]="guardar" />
          Guardar este correo en los datos de {{ v.cliente }}
        </label>
      }
    </div>
  `,
})
export class EnvioCorreoComponent implements OnDestroy {
  private readonly api = inject(VentasApi);
  private readonly toast = inject(ToastService);
  readonly venta = input.required<Venta>();
  readonly actualizada = output<Venta>();
  readonly enviando = signal(false);
  correo = '';
  guardar = true;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const v = this.venta();
      if (!this.correo) this.correo = v.clienteCorreo ?? '';
      // Mientras haya un envío en curso, consulta el estado cada pocos segundos.
      clearTimeout(this.timer);
      if (v.correos.some((c) => c.estado === 'PENDIENTE'))
        this.timer = setTimeout(
          () => this.api.venta(v.id).subscribe((x) => this.actualizada.emit(x)),
          4000,
        );
    });
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  valido() {
    return CORREO.test(this.correo.trim());
  }
  estado(e: keyof typeof ESTADO) {
    return ESTADO[e] ?? { texto: e, clase: 'badge' };
  }

  enviar() {
    const v = this.venta();
    const correo = this.correo.trim();
    this.enviando.set(true);
    this.api
      .enviarComprobante(v.id, {
        correo,
        guardarEnCliente: !v.clienteCorreo && this.guardar,
      })
      .subscribe({
        next: (x) => {
          this.enviando.set(false);
          this.toast.ok(`Comprobante en camino a ${correo}`);
          this.actualizada.emit(x);
        },
        error: (e) => {
          this.enviando.set(false);
          this.toast.error(mensajeError(e));
        },
      });
  }
}
