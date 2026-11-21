import { QuetzalPipe } from '../../shared/quetzal.pipe';
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Acta, ESTADO_TURNO } from '../../core/ventas/ventas.api';

/** Acta de turno (R-08): conteos, cuadre por método, pagos con referencia y movimientos de caja. */
@Component({
  selector: 'app-acta',
  imports: [QuetzalPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @let a = acta();
    <div class="card space-y-4 text-sm print:border-0 print:p-0">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-base font-semibold">Acta de turno #{{ a.id }}</p>
          <p class="muted">
            Caja {{ a.cajaNumero }} · {{ a.colegio }} · {{ a.cajero }} ({{ a.username }})
          </p>
          <p class="muted">
            Abierto {{ a.abiertoEn | date: 'dd/MM/yyyy HH:mm' }}
            @if (a.cerradoEn) {
              · cerrado {{ a.cerradoEn | date: 'dd/MM/yyyy HH:mm' }} por {{ a.cerradoPor }}
            }
          </p>
        </div>
        <div class="text-right">
          <span [class]="estado(a.estado).clase">{{ estado(a.estado).texto }}</span>
          @if (a.forzado) {
            <span class="badge-off ml-1">Cierre forzado</span>
          }
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <p class="label">Efectivo</p>
          <dl class="space-y-0.5">
            <div class="flex justify-between">
              <dt>Fondo inicial</dt>
              <dd class="money">Q{{ a.fondoInicial }}</dd>
            </div>
            @if (a.resumen.efectivoVentas !== null) {
              <div class="flex justify-between">
                <dt>+ Ventas en efectivo</dt>
                <dd class="money">Q{{ a.resumen.efectivoVentas }}</dd>
              </div>
            }
            <div class="flex justify-between">
              <dt>− Retiros</dt>
              <dd class="money">Q{{ a.resumen.retiros }}</dd>
            </div>
            <div class="flex justify-between">
              <dt>+ Ingresos</dt>
              <dd class="money">Q{{ a.resumen.ingresos }}</dd>
            </div>
            <div class="flex justify-between">
              <dt>− Reembolsos</dt>
              <dd class="money">Q{{ a.resumen.reembolsos }}</dd>
            </div>
            @if (a.resumen.efectivoEsperado !== null) {
              <div
                class="flex justify-between border-t border-zinc-200 pt-1 font-medium dark:border-zinc-800"
              >
                <dt>Esperado</dt>
                <dd class="money">Q{{ a.resumen.efectivoEsperado }}</dd>
              </div>
            } @else {
              <p class="muted text-xs">
                El esperado se muestra después de registrar el conteo (cierre ciego).
              </p>
            }
            @if (a.resumen.efectivoContado) {
              <div class="flex justify-between">
                <dt>Contado</dt>
                <dd class="money">Q{{ a.resumen.efectivoContado }}</dd>
              </div>
              <div
                class="flex justify-between font-medium"
                [class.text-rose-600]="a.resumen.diferencia !== '0.00'"
              >
                <dt>Diferencia</dt>
                <dd class="money">{{ a.resumen.diferencia | quetzal }}</dd>
              </div>
              <div class="flex justify-between border-t border-zinc-200 pt-1 dark:border-zinc-800">
                <dt>Fondo a conservar</dt>
                <dd class="money">Q{{ a.resumen.fondoAConservar }}</dd>
              </div>
              <div class="flex justify-between text-base font-semibold">
                <dt>Efectivo a entregar</dt>
                <dd class="money">Q{{ a.resumen.efectivoAEntregar }}</dd>
              </div>
            }
          </dl>
        </div>
        <div>
          <p class="label">Otros medios (conciliar contra banco / plataforma)</p>
          <dl class="space-y-0.5">
            <div class="flex justify-between">
              <dt>Tarjeta</dt>
              <dd class="money">Q{{ a.resumen.tarjeta }}</dd>
            </div>
            <div class="flex justify-between">
              <dt>Transferencia</dt>
              <dd class="money">Q{{ a.resumen.transferencia }}</dd>
            </div>
            <div class="flex justify-between">
              <dt>Ventas del turno</dt>
              <dd>{{ a.resumen.ventas }}</dd>
            </div>
          </dl>
        </div>
      </div>

      @if (a.pagos.length) {
        <div class="overflow-x-auto">
          <p class="label">Pagos con tarjeta y transferencia</p>
          <table class="table">
            <thead>
              <tr>
                <th>Venta</th>
                <th>Método</th>
                <th>Referencia</th>
                <th class="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              @for (p of a.pagos; track p.id) {
                <tr>
                  <td class="font-mono text-xs">{{ p.venta }}</td>
                  <td>{{ p.nombre }}{{ p.medio ? ' · ' + p.medio : '' }}</td>
                  <td class="font-mono text-xs">{{ p.referencia }}</td>
                  <td class="money text-right">{{ p.montoTotal }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (a.movimientos.length) {
        <div class="overflow-x-auto">
          <p class="label">Movimientos de caja</p>
          <table class="table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Usuario</th>
                <th class="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              @for (m of a.movimientos; track m.id) {
                <tr>
                  <td>{{ m.fecha | date: 'HH:mm' }}</td>
                  <td>{{ m.tipo }}</td>
                  <td>{{ m.motivo }}</td>
                  <td>{{ m.usuario }}</td>
                  <td class="money text-right">{{ m.monto }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (a.conteoCierre.length || a.conteoApertura.length) {
        <div class="grid gap-4 sm:grid-cols-2">
          @for (
            c of [
              { t: 'Conteo de apertura', f: a.conteoApertura },
              { t: 'Conteo de cierre', f: a.conteoCierre },
            ];
            track c.t
          ) {
            @if (c.f.length) {
              <div>
                <p class="label">{{ c.t }}</p>
                @for (d of c.f; track d.denominacionId) {
                  @if (d.cantidad) {
                    <div class="flex justify-between text-xs">
                      <span
                        >{{ d.tipo === 'BILLETE' ? 'Billete' : 'Moneda' }} Q{{ d.valor }} ×
                        {{ d.cantidad }}</span
                      >
                      <span class="money">Q{{ d.subtotal }}</span>
                    </div>
                  }
                }
              </div>
            }
          }
        </div>
      }

      @for (
        o of [
          { t: 'Observación de apertura', v: a.observacionApertura },
          { t: 'Observación de cierre', v: a.observacionCierre },
          { t: 'Validación (' + (a.validadoPor ?? '') + ')', v: a.observacionValidacion },
        ];
        track o.t
      ) {
        @if (o.v) {
          <p>
            <span class="label inline">{{ o.t }}:</span> {{ o.v }}
          </p>
        }
      }

      <div class="hidden grid-cols-2 gap-8 pt-10 text-center text-xs print:grid">
        <p class="border-t border-zinc-400 pt-1">Entrega: {{ a.cajero }}</p>
        <p class="border-t border-zinc-400 pt-1">Recibe (Contador)</p>
      </div>
    </div>
  `,
})
export class ActaComponent {
  readonly acta = input.required<Acta>();
  estado(e: keyof typeof ESTADO_TURNO) {
    return ESTADO_TURNO[e];
  }
}
