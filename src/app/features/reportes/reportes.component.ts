import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Rol } from '../../core/auth/auth.models';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { Columna, Filtros, Reporte, ReportesApi } from '../../core/reportes/reportes.api';
import { Colegio, ColegiosService } from '../admin/colegios/colegios.service';
import { QuetzalPipe } from '../../shared/quetzal.pipe';

type Filtro = 'fechas' | 'colegio' | 'estado' | 'entidad';
interface Definicion {
  tipo: string;
  nombre: string;
  descripcion: string;
  roles: Rol[];
  filtros: Filtro[];
  estados?: { valor: string; texto: string }[];
}

const TODOS: Rol[] = ['ADMIN', 'CONTADOR', 'CAJERO'];
const SUP: Rol[] = ['ADMIN', 'CONTADOR'];

/** Catálogo de reportes (sección 10 del documento). */
const REPORTES: Definicion[] = [
  {
    tipo: 'ventas',
    nombre: 'Ventas por período',
    descripcion: 'Cada venta con cliente, caja, usuario y totales. El cajero ve solo las suyas.',
    roles: TODOS,
    filtros: ['fechas', 'colegio', 'estado'],
    estados: [
      { valor: 'PAGADA', texto: 'Pagadas' },
      { valor: 'ANULADA', texto: 'Anuladas' },
    ],
  },
  {
    tipo: 'metodos-pago',
    nombre: 'Resumen por método de pago',
    descripcion: 'Pagos, monto base, recargo y total por método.',
    roles: SUP,
    filtros: ['fechas', 'colegio'],
  },
  {
    tipo: 'libros',
    nombre: 'Libros vendidos',
    descripcion: 'Cantidad y monto por libro, colegio y grado.',
    roles: SUP,
    filtros: ['fechas', 'colegio'],
  },
  {
    tipo: 'pendientes',
    nombre: 'Pendientes de entrega',
    descripcion: 'Libros reservados, en traslado o por proveedor, con días de espera.',
    roles: TODOS,
    filtros: ['colegio', 'estado'],
    estados: [
      { valor: 'RESERVADO', texto: 'Reservado' },
      { valor: 'PENDIENTE_TRASLADO', texto: 'Pendiente de traslado' },
      { valor: 'EN_TRANSITO', texto: 'En tránsito' },
      { valor: 'PENDIENTE_PROVEEDOR', texto: 'Pendiente de proveedor' },
      { valor: 'EN_PEDIDO', texto: 'En pedido' },
    ],
  },
  {
    tipo: 'cuadres',
    nombre: 'Cuadres de caja',
    descripcion: 'Turnos con fondo, esperado contra contado, diferencias y validación.',
    roles: SUP,
    filtros: ['fechas', 'colegio', 'estado'],
    estados: ['ABIERTO', 'EN_CIERRE', 'CERRADO', 'VALIDADO', 'OBSERVADO'].map((v) => ({
      valor: v,
      texto: v,
    })),
  },
  {
    tipo: 'diferencias',
    nombre: 'Diferencias de caja',
    descripcion: 'Faltantes y sobrantes por usuario.',
    roles: SUP,
    filtros: ['fechas', 'colegio'],
  },
  {
    tipo: 'existencias',
    nombre: 'Existencias',
    descripcion: 'Existencia, reservado y disponible por colegio y libro.',
    roles: SUP,
    filtros: ['colegio'],
  },
  {
    tipo: 'anuladas',
    nombre: 'Ventas anuladas',
    descripcion: 'Con motivo, quién anuló y reembolso en efectivo.',
    roles: SUP,
    filtros: ['fechas', 'colegio'],
  },
  {
    tipo: 'bitacora',
    nombre: 'Bitácora de auditoría',
    descripcion: 'Acciones por usuario, entidad y fecha (precios, recargos, anulaciones…).',
    roles: SUP,
    filtros: ['fechas', 'entidad'],
  },
];

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

@Component({
    selector: 'app-reportes',
    imports: [FormsModule, DatePipe, QuetzalPipe],
    template: `
    <h1 class="page-title mb-4">Reportes</h1>
    <div class="space-y-4">
      <nav class="flex flex-wrap gap-1" aria-label="Reportes">
        @for (r of disponibles; track r.tipo) {
          <button
            class="rounded-lg px-3 py-1.5 text-sm"
            [class]="
              r.tipo === def().tipo
                ? 'bg-zinc-100 font-medium dark:bg-zinc-800'
                : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
            "
            (click)="elegir(r.tipo)"
          >
            {{ r.nombre }}
          </button>
        }
      </nav>

      <div class="min-w-0 space-y-4">
        <div class="card space-y-3">
          <div>
            <p class="font-medium">{{ def().nombre }}</p>
            <p class="muted text-sm">{{ def().descripcion }}</p>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            @if (usa('fechas')) {
              <div>
                <label class="label" for="desde">Desde</label>
                <input id="desde" class="input w-40" type="date" [(ngModel)]="f.desde" />
              </div>
              <div>
                <label class="label" for="hasta">Hasta</label>
                <input id="hasta" class="input w-40" type="date" [(ngModel)]="f.hasta" />
              </div>
            }
            @if (usa('colegio') && !esCajero) {
              <div>
                <label class="label" for="col">Colegio</label>
                <select id="col" class="input w-48" [(ngModel)]="f.colegioId">
                  <option value="">Todos</option>
                  @for (c of colegios(); track c.id) {
                    <option [value]="c.id">{{ c.nombre }}</option>
                  }
                </select>
              </div>
            }
            @if (usa('estado') && def().estados) {
              <div>
                <label class="label" for="est">Estado</label>
                <select id="est" class="input w-48" [(ngModel)]="f.estado">
                  <option value="">Todos</option>
                  @for (e of def().estados!; track e.valor) {
                    <option [value]="e.valor">{{ e.texto }}</option>
                  }
                </select>
              </div>
            }
            @if (usa('entidad')) {
              <div>
                <label class="label" for="ent">Entidad</label>
                <select id="ent" class="input w-44" [(ngModel)]="f.entidad">
                  <option value="">Todas</option>
                  @for (e of entidades; track e) {
                    <option [value]="e">{{ e }}</option>
                  }
                </select>
              </div>
            }
            <button class="btn-primary" [disabled]="cargando()" (click)="ver()">Ver reporte</button>
            <button class="btn-secondary" [disabled]="exportando()" (click)="exportar()">
              {{ exportando() ? 'Generando…' : 'Exportar a Excel' }}
            </button>
          </div>
        </div>

        @if (rep(); as r) {
          <div class="card overflow-x-auto p-0">
            <div class="flex items-center justify-between px-3 pt-3">
              <p class="font-medium">{{ r.titulo }}</p>
              <p class="muted text-sm">
                {{ r.filas.length }} fila(s){{
                  r.recortado ? ' · se muestran las primeras; exporte a Excel para ver todas' : ''
                }}
              </p>
            </div>
            <table class="table">
              <thead>
                <tr>
                  @for (c of r.columnas; track c.clave) {
                    <th [class.text-right]="numerica(c)">{{ c.titulo }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (fila of r.filas; track $index) {
                  <tr>
                    @for (c of r.columnas; track c.clave) {
                      <td
                        [class.text-right]="numerica(c)"
                        [class.money]="numerica(c)"
                        [class.whitespace-nowrap]="c.clave !== 'detalle'"
                        [class.max-w-md]="c.clave === 'detalle'"
                        [class.truncate]="c.clave === 'detalle'"
                        [attr.title]="c.clave === 'detalle' ? fila[c.clave] : null"
                      >
                        @switch (c.tipo) {
                          @case ('dinero') {
                            {{ $any(fila[c.clave]) | quetzal }}
                          }
                          @case ('fecha') {
                            {{ $any(fila[c.clave]) | date: 'dd/MM/yyyy' }}
                          }
                          @case ('fechaHora') {
                            {{ $any(fila[c.clave]) | date: 'dd/MM/yyyy HH:mm' }}
                          }
                          @default {
                            {{ fila[c.clave] ?? '—' }}
                          }
                        }
                      </td>
                    }
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="r.columnas.length" class="py-8 text-center muted">
                      Sin datos para estos filtros
                    </td>
                  </tr>
                }
              </tbody>
              @if (r.filas.length && tieneTotales()) {
                <tfoot>
                  <tr class="font-semibold">
                    @for (c of r.columnas; track c.clave; let i = $index) {
                      <td
                        [class.text-right]="numerica(c)"
                        [class.money]="numerica(c)"
                        class="border-t border-zinc-200 dark:border-zinc-800"
                      >
                        @if (r.totales[c.clave] !== undefined) {
                          {{
                            c.tipo === 'dinero'
                              ? (r.totales[c.clave] | quetzal)
                              : r.totales[c.clave]
                          }}
                        } @else if (i === 0) {
                          Totales{{ def().tipo === 'ventas' ? ' (pagadas)' : '' }}
                        }
                      </td>
                    }
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        }
      </div>
    </div>
  `
})
export class ReportesComponent implements OnInit {
  private readonly api = inject(ReportesApi);
  private readonly colegiosService = inject(ColegiosService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly esCajero = this.auth.tieneRol('CAJERO');
  readonly disponibles = REPORTES.filter((r) => this.auth.tieneRol(...r.roles));
  readonly entidades = [
    'venta',
    'turno_caja',
    'precio_libro',
    'metodo_pago',
    'inventario',
    'usuario',
    'libro',
    'combo',
    'traslado',
    'pedido_proveedor',
  ];

  readonly def = signal<Definicion>(this.disponibles[0]);
  readonly colegios = signal<Colegio[]>([]);
  readonly rep = signal<Reporte | null>(null);
  readonly cargando = signal(false);
  readonly exportando = signal(false);
  readonly tieneTotales = computed(() => Object.keys(this.rep()?.totales ?? {}).length > 0);
  f: { desde: string; hasta: string; colegioId: string; estado: string; entidad: string } = {
    desde: hoyISO().slice(0, 8) + '01',
    hasta: hoyISO(),
    colegioId: '',
    estado: '',
    entidad: '',
  };

  ngOnInit() {
    if (!this.esCajero)
      this.colegiosService
        .listar('', 1, 200)
        .subscribe((r) => this.colegios.set(r.data.filter((c) => c.activo)));
    const tipo = this.route.snapshot.queryParamMap.get('tipo');
    if (tipo && this.disponibles.some((r) => r.tipo === tipo)) {
      this.elegir(tipo);
      this.ver();
    }
  }

  usa(x: Filtro) {
    return this.def().filtros.includes(x);
  }
  numerica(c: Columna) {
    return c.tipo === 'dinero' || c.tipo === 'entero';
  }

  elegir(tipo: string) {
    this.def.set(this.disponibles.find((r) => r.tipo === tipo)!);
    this.f.estado = '';
    this.rep.set(null);
  }

  private filtros(): Filtros {
    const d = this.def();
    return {
      ...(this.usa('fechas') ? { desde: this.f.desde, hasta: this.f.hasta } : {}),
      ...(this.usa('colegio') && this.f.colegioId ? { colegioId: this.f.colegioId } : {}),
      ...(this.usa('estado') && d.estados && this.f.estado ? { estado: this.f.estado } : {}),
      ...(this.usa('entidad') && this.f.entidad ? { entidad: this.f.entidad } : {}),
    };
  }

  ver() {
    this.cargando.set(true);
    this.api.reporte(this.def().tipo, this.filtros()).subscribe({
      next: (r) => {
        this.rep.set(r);
        this.cargando.set(false);
      },
      error: (e) => {
        this.toast.error(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  exportar() {
    this.exportando.set(true);
    this.api.excel(this.def().tipo, this.filtros()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-${this.def().tipo}-${hoyISO()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportando.set(false);
      },
      error: (e) => {
        this.toast.error(mensajeError(e));
        this.exportando.set(false);
      },
    });
  }
}
