import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ESTADO_LINEA, Venta } from '../../core/ventas/ventas.api';

/** Comprobante de venta (RF-09), con los libros pendientes de entrega. Se imprime con el navegador. */
@Component({
  selector: 'app-comprobante',
  standalone: true,
  imports: [DatePipe],
  template: `
    @let v = venta();
    <div class="card mx-auto max-w-xl space-y-3 text-sm print:max-w-none print:border-0 print:p-0">
      <div class="text-center">
        <p class="text-base font-semibold tracking-wide">INTELECTO</p>
        <p class="muted">Comprobante de venta · {{ v.colegio }}</p>
      </div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span class="muted">Venta</span><span class="text-right font-mono">{{ v.codigo }}</span>
        <span class="muted">Fecha</span
        ><span class="text-right">{{ v.fecha | date: 'dd/MM/yyyy HH:mm' }}</span>
        @if (v.cajaNumero) {
          <span class="muted">Caja</span
          ><span class="text-right">{{ v.cajaNumero }} · {{ v.usuario }}</span>
        }
        <span class="muted">Cliente</span><span class="text-right">{{ v.cliente }}</span>
        <span class="muted">NIT</span><span class="text-right font-mono">{{ v.nit }}</span>
        @if (v.alumno) {
          <span class="muted">Alumno</span
          ><span class="text-right">{{ v.alumno }}{{ v.grado ? ' · ' + v.grado : '' }}</span>
        }
      </div>
      @if (v.estadoPago === 'ANULADA') {
        <p class="rounded-lg border border-rose-500 p-2 text-center font-medium text-rose-600">
          ANULADA · {{ v.motivoAnulacion }}
        </p>
      }
      <table class="w-full">
        <thead>
          <tr class="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
            <th class="py-1">Libro</th>
            <th class="py-1 text-right">Cant.</th>
            <th class="py-1 text-right">Precio</th>
            <th class="py-1 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          @for (l of v.lineas; track l.id) {
            <tr class="align-top">
              <td class="py-1">
                {{ l.titulo }}
                @if (l.estado !== 'ENTREGADO') {
                  <span class="block text-xs text-amber-600"
                    >{{ estado(l.estado)
                    }}{{ l.colegioOrigen ? ' (' + l.colegioOrigen + ')' : '' }}</span
                  >
                }
              </td>
              <td class="money py-1 text-right">{{ l.cantidad }}</td>
              <td class="money py-1 text-right">{{ l.precioUnitario }}</td>
              <td class="money py-1 text-right">{{ l.subtotal }}</td>
            </tr>
          }
        </tbody>
      </table>
      <div class="space-y-0.5 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        <div class="flex justify-between">
          <span>Subtotal</span><span class="money">Q{{ v.subtotal }}</span>
        </div>
        @if (v.descuento !== '0.00') {
          <div class="flex justify-between">
            <span>Descuento combo</span><span class="money">−Q{{ v.descuento }}</span>
          </div>
        }
        @if (v.recargo !== '0.00') {
          <div class="flex justify-between">
            <span>Recargo por tarjeta</span><span class="money">Q{{ v.recargo }}</span>
          </div>
        }
        <div class="flex justify-between text-base font-semibold">
          <span>Total</span><span class="money">Q{{ v.total }}</span>
        </div>
      </div>
      <div class="space-y-0.5 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        @for (p of v.pagos; track p.id) {
          <div class="flex justify-between">
            <span>
              {{ p.nombre }}
              @if (p.recargo !== '0.00') {
                <span class="muted">(+{{ p.recargoPct }} % = Q{{ p.recargo }})</span>
              }
              @if (p.referencia) {
                <span class="muted"> · Ref. {{ p.referencia }}</span>
              }
            </span>
            <span class="money">Q{{ p.montoTotal }}</span>
          </div>
          @if (p.vuelto && p.vuelto !== '0.00') {
            <div class="muted flex justify-between pl-4 text-xs">
              <span>Recibido Q{{ p.recibido }}</span
              ><span>Vuelto Q{{ p.vuelto }}</span>
            </div>
          }
        }
      </div>
      @if (pendientes().length) {
        <div class="rounded-lg border border-amber-500 p-2 text-xs">
          <p class="font-medium">Libros pendientes de entrega</p>
          <p>Presente este comprobante para recogerlos:</p>
          <ul class="list-inside list-disc">
            @for (l of pendientes(); track l.id) {
              <li>
                {{ l.cantidad - l.cantidadEntregada }} × {{ l.titulo }} — {{ estado(l.estado) }}
              </li>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class ComprobanteComponent {
  readonly venta = input.required<Venta>();
  readonly pendientes = computed(() =>
    this.venta().lineas.filter((l) => !['ENTREGADO', 'ANULADO'].includes(l.estado)),
  );
  estado(e: string) {
    return ESTADO_LINEA[e as keyof typeof ESTADO_LINEA]?.texto ?? e;
  }
}
