import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Empresa, ESTADO_LINEA, Venta } from '../../core/ventas/ventas.api';

type Linea = Venta['lineas'][number];
interface Bloque {
  titulo: string;
  grado: string | null;
  licencia: string | null;
  descuento: string;
  lineas: Linea[];
}

/**
 * Comprobante de compra en formato ticket para impresora térmica de 80 mm (área útil 72 mm).
 * Agrupa los útiles por alumno, con su grado y licencia digital. Se imprime con el navegador:
 * todo lo demás de la página lleva `print:hidden`.
 */
@Component({
  selector: 'app-comprobante',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @let v = venta();
    @let e = empresa();
    <article class="ticket" aria-label="Comprobante de compra">
      <header class="centro">
        <p class="grande">{{ e?.nombre ?? 'Intelecto' }}</p>
        @if (e?.nit) {
          <p>NIT {{ e!.nit }}</p>
        }
        @if (e?.direccion) {
          <p>{{ e!.direccion }}</p>
        }
        @if (e?.telefono || e?.correo) {
          <p>{{ e?.telefono }}{{ e?.telefono && e?.correo ? ' · ' : '' }}{{ e?.correo }}</p>
        }
        <p class="separa">COMPROBANTE DE COMPRA</p>
        <p>{{ v.colegio }}</p>
      </header>

      <div class="linea"></div>
      <div class="par">
        <span>Venta</span><strong>{{ v.codigo }}</strong>
      </div>
      <div class="par">
        <span>Fecha</span><span>{{ v.fecha | date: 'dd/MM/yyyy HH:mm' }}</span>
      </div>
      @if (v.cajaNumero) {
        <div class="par">
          <span>Caja</span><span>{{ v.cajaNumero }} · {{ v.usuario }}</span>
        </div>
      }
      <div class="par">
        <span>Cliente</span><span class="der">{{ v.cliente }}</span>
      </div>
      <div class="par">
        <span>NIT</span><span>{{ v.nit }}</span>
      </div>

      @if (v.estadoPago === 'ANULADA') {
        <p class="anulada">*** VENTA ANULADA ***<br />{{ v.motivoAnulacion }}</p>
      } @else if (v.estadoEntrega === 'COMPLETA') {
        <p class="estado-orden">
          ENTREGADO
          @if (v.entregaCompletaEn) {
            <br /><span class="chico">el {{ v.entregaCompletaEn | date: 'dd/MM/yyyy HH:mm' }}</span>
          }
        </p>
      } @else {
        <p class="estado-orden pendiente">
          PENDIENTE DE ENTREGA<br /><span class="chico">{{ faltan() }} libro(s) por entregar</span>
        </p>
      }

      @for (b of bloques(); track $index) {
        <section class="alumno">
          <p class="nombre">ALUMNO: {{ b.titulo }}</p>
          @if (b.grado) {
            <p>Grado: {{ b.grado }}</p>
          }
          @if (b.licencia) {
            <p class="licencia">
              Licencia digital<br /><strong>{{ b.licencia }}</strong>
              @if (e?.sitioLicencias) {
                <br /><span class="chico">{{ e!.sitioLicencias }}</span>
              }
            </p>
          }
          @for (l of b.lineas; track l.id) {
            <div class="item">
              <span>{{ l.cantidad }} × {{ l.titulo }}</span>
              <span class="monto">Q{{ l.subtotal }}</span>
            </div>
            @if (l.estado === 'ENTREGADO' && entregaPosterior(l)) {
              <p class="estado">↳ Entregado el {{ l.entregadoEn | date: 'dd/MM/yyyy' }}</p>
            } @else if (l.estado !== 'ENTREGADO') {
              <p class="estado">
                ↳ {{ estado(l.estado) }}{{ l.colegioOrigen ? ' (' + l.colegioOrigen + ')' : '' }}
              </p>
            }
          }
          @if (b.descuento !== '0.00') {
            <div class="item">
              <span>Descuento combo</span><span class="monto">−Q{{ b.descuento }}</span>
            </div>
          }
        </section>
      }

      <div class="linea"></div>
      <div class="par">
        <span>Subtotal</span><span>Q{{ v.subtotal }}</span>
      </div>
      @if (v.descuento !== '0.00') {
        <div class="par">
          <span>Descuentos</span><span>−Q{{ v.descuento }}</span>
        </div>
      }
      @if (v.recargo !== '0.00') {
        <div class="par">
          <span>Recargo tarjeta</span><span>Q{{ v.recargo }}</span>
        </div>
      }
      <div class="par total">
        <span>TOTAL</span><span>Q{{ v.total }}</span>
      </div>
      @for (p of v.pagos; track p.id) {
        <div class="par chico">
          <span
            >{{ p.nombre }}{{ p.referencia ? ' · Ref. ' + p.referencia : ''
            }}{{ p.recargo !== '0.00' ? ' (+' + p.recargoPct + '%)' : '' }}</span
          >
          <span>Q{{ p.montoTotal }}</span>
        </div>
        @if (p.vuelto && p.vuelto !== '0.00') {
          <div class="par chico">
            <span>Recibido Q{{ p.recibido }}</span
            ><span>Vuelto Q{{ p.vuelto }}</span>
          </div>
        }
      }

      @if (pendientes()) {
        <p class="aviso">
          Hay libros pendientes de entrega. Presente este comprobante para recogerlos.
        </p>
      }
      @if (e?.pie) {
        <p class="centro chico pie">{{ e!.pie }}</p>
      }
      <p class="centro chico">{{ v.codigo }}</p>
    </article>
  `,
  styles: `
    /* Papel: blanco y negro siempre (también en modo oscuro), como saldrá impreso. */
    .ticket {
      width: 72mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 4mm 3mm;
      background: #fff;
      color: #000;
      font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
      font-size: 11.5px;
      line-height: 1.35;
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
      word-break: break-word;
    }
    p {
      margin: 0;
    }
    .centro {
      text-align: center;
    }
    .grande {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .separa {
      margin-top: 2mm;
      font-weight: 700;
    }
    .chico {
      font-size: 10px;
    }
    .linea {
      border-top: 1px dashed #000;
      margin: 2mm 0;
    }
    .par,
    .item {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
    }
    .der {
      text-align: right;
    }
    .monto {
      white-space: nowrap;
    }
    .alumno {
      border-top: 1px dashed #000;
      margin-top: 2mm;
      padding-top: 2mm;
    }
    .nombre {
      font-weight: 700;
    }
    .licencia {
      margin: 1.5mm 0;
      padding: 1.5mm;
      border: 1px solid #000;
      text-align: center;
    }
    .licencia strong {
      font-size: 13px;
      letter-spacing: 0.05em;
    }
    .estado {
      padding-left: 3mm;
      font-size: 10px;
    }
    .total {
      margin-top: 1mm;
      font-size: 14px;
      font-weight: 700;
    }
    .estado-orden {
      margin: 2mm 0;
      padding: 1.5mm;
      border: 2px solid #000;
      text-align: center;
      font-weight: 700;
      font-size: 13px;
    }
    .estado-orden.pendiente {
      border-style: double;
      border-width: 3px;
    }
    .anulada,
    .aviso {
      margin: 2mm 0;
      padding: 1.5mm;
      border: 1px solid #000;
      text-align: center;
      font-weight: 700;
    }
    .aviso {
      font-weight: 400;
      font-size: 10px;
    }
    .pie {
      margin-top: 3mm;
    }
    @media print {
      .ticket {
        box-shadow: none;
        padding: 0 1mm;
      }
    }
  `,
})
export class ComprobanteComponent {
  readonly venta = input.required<Venta>();
  readonly empresa = input<Empresa | null>(null);

  /** Útiles por alumno (en el orden de la venta); lo que no tiene alumno va al final. */
  readonly bloques = computed<Bloque[]>(() => {
    const v = this.venta();
    const alumnos = v.alumnos ?? [];
    const bloques: Bloque[] = alumnos.map((a) => ({
      titulo: a.nombre,
      grado: a.grado,
      licencia: a.licencia,
      descuento: a.descuento,
      lineas: v.lineas.filter((l) => l.ventaAlumnoId === a.id),
    }));
    const sueltas = v.lineas.filter((l) => !l.ventaAlumnoId);
    if (sueltas.length)
      bloques.push({
        titulo: v.alumno || (bloques.length ? 'Otros' : 'Libros'),
        grado: alumnos.length ? null : v.grado,
        licencia: null,
        descuento: alumnos.length ? '0.00' : v.descuento,
        lineas: sueltas,
      });
    return bloques;
  });
  readonly pendientes = computed(() =>
    this.venta().lineas.some((l) => !['ENTREGADO', 'ANULADO'].includes(l.estado)),
  );
  readonly faltan = computed(() =>
    this.venta()
      .lineas.filter((l) => l.estado !== 'ANULADO')
      .reduce((a, l) => a + l.cantidad - l.cantidadEntregada, 0),
  );
  /** Entregado otro día que la venta (p. ej. llegó por traslado): se imprime la fecha. */
  entregaPosterior(l: Linea) {
    return (
      !!l.entregadoEn &&
      new Date(l.entregadoEn).toDateString() !== new Date(this.venta().fecha).toDateString()
    );
  }
  estado(e: string) {
    return ESTADO_LINEA[e as keyof typeof ESTADO_LINEA]?.texto ?? e;
  }
}
