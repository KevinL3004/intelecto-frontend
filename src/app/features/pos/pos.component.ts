import {
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, switchMap, catchError, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { CatalogoApi, Combo, FilaPrecio, Grado } from '../../core/catalogo/catalogo.api';
import { AdminApi, Persona } from '../../core/admin/admin.api';
import {
  CajaDisponible,
  Conteo,
  Cotizacion,
  Denominacion,
  ESTADO_LINEA,
  Metodo,
  PagoEntrada,
  Venta,
  VentasApi,
} from '../../core/ventas/ventas.api';
import { ConteoComponent } from '../../shared/conteo.component';
import { ComprobanteComponent } from '../ventas/comprobante.component';

interface Linea {
  libroId: number;
  titulo: string;
  cantidad: number;
}
interface PagoForm {
  metodoPagoId: number;
  montoBase: string;
  recibido: string;
  referencia: string;
  medio: '' | 'TERMINAL' | 'LINK_PAGO' | 'OTRO';
}

/**
 * Punto de venta: apertura de turno (CU-02), venta (CU-04) y cobro (CU-05).
 * El frontend nunca calcula montos finales: todo sale de POST /ventas/cotizar.
 */
@Component({
    selector: 'app-pos',
    imports: [FormsModule, DatePipe, RouterLink, ConteoComponent, ComprobanteComponent],
    template: `
    @if (cargando()) {
      <p class="muted">Cargando…</p>
    } @else if (!turno()) {
      <!-- ================= APERTURA ================= -->
      <h1 class="page-title">Abrir turno de caja</h1>
      <p class="muted mb-4">Elija la caja y cuente el fondo (sencillo) con el que inicia.</p>
      @if (!cajas().length) {
        <div class="card muted">No hay cajas disponibles. Todas están ocupadas o inactivas.</div>
      } @else {
        <div class="card space-y-4">
          <div class="flex flex-wrap gap-2">
            @for (c of cajas(); track c.id) {
              <button
                class="btn"
                [class]="cajaId() === c.id ? 'btn-primary' : 'btn-secondary'"
                (click)="cajaId.set(c.id)"
              >
                Caja {{ c.numero }} · {{ c.colegio }}
              </button>
            }
          </div>
          @if (cajaSel(); as caja) {
            <p class="text-sm">
              Fondo asignado a la caja: <strong class="money">Q{{ caja.fondoAsignado }}</strong>
            </p>
            <app-conteo [denominaciones]="denominaciones()" (cambio)="conteoApertura = $event" />
            @if (conteoApertura.total !== fondoNormal(caja.fondoAsignado)) {
              <div>
                <label class="label" for="obsA">
                  El fondo contado no coincide con el asignado: escriba una observación
                </label>
                <input id="obsA" class="input" maxlength="250" [(ngModel)]="obsApertura" />
              </div>
            }
            <div class="flex justify-end">
              <button
                class="btn-primary"
                [disabled]="
                  procesando() ||
                  (conteoApertura.total !== fondoNormal(caja.fondoAsignado) && !obsApertura.trim())
                "
                (click)="abrir()"
              >
                Abrir turno
              </button>
            </div>
          }
        </div>
      }
    } @else if (comprobante()) {
      <!-- ================= COMPROBANTE ================= -->
      <app-comprobante [venta]="comprobante()!" />
      <div class="mt-4 flex justify-end gap-2 print:hidden">
        <button class="btn-secondary" (click)="imprimir()">Imprimir</button>
        <button class="btn-primary" (click)="nuevaVenta()">Nueva venta (F2)</button>
      </div>
    } @else {
      <!-- ================= VENTA ================= -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 class="page-title">Punto de venta</h1>
          <p class="muted">
            Caja {{ turno()!.cajaNumero }} · {{ turno()!.colegio }} · turno abierto desde
            {{ turno()!.abiertoEn | date: 'HH:mm' }}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary btn-sm" (click)="nuevaVenta()">Limpiar (F2)</button>
          <a class="btn-secondary btn-sm" routerLink="/pos/cierre">Cerrar turno</a>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-5">
        <!-- Columna izquierda: cliente y libros -->
        <div class="space-y-4 lg:col-span-3">
          <div class="card grid gap-3 sm:grid-cols-2">
            <div class="relative sm:col-span-2">
              <label class="label" for="cli">Cliente (NIT o nombre)</label>
              @if (cliente(); as c) {
                <div
                  class="flex items-center justify-between rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                >
                  <span
                    >{{ c.nombres }} {{ c.apellidos }} ·
                    <span class="font-mono">{{ c.nit }}</span></span
                  >
                  <button class="btn-ghost btn-sm" (click)="cliente.set(null)">Cambiar</button>
                </div>
              } @else {
                <input
                  id="cli"
                  class="input"
                  placeholder="Buscar cliente… (vacío = Consumidor Final)"
                  autocomplete="off"
                  [ngModel]="busquedaCliente()"
                  (ngModelChange)="buscarCliente($event)"
                />
                @if (resultadosCliente().length || busquedaCliente()) {
                  <div
                    class="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    @for (p of resultadosCliente(); track p.id) {
                      <button
                        class="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        (click)="elegirCliente(p)"
                      >
                        {{ p.nombres }} {{ p.apellidos }} ·
                        <span class="font-mono">{{ p.nit }}</span>
                      </button>
                    }
                    <button
                      class="block w-full px-3 py-2 text-left text-sm text-accent-600 hover:bg-zinc-100 dark:text-accent-400 dark:hover:bg-zinc-800"
                      (click)="nuevoCliente.set(true)"
                    >
                      + Registrar cliente nuevo
                    </button>
                  </div>
                }
              }
            </div>
            @if (nuevoCliente()) {
              <div
                class="grid gap-2 rounded-lg border border-dashed border-zinc-300 p-3 sm:col-span-2 sm:grid-cols-4 dark:border-zinc-700"
              >
                <input class="input" placeholder="Nombres" [(ngModel)]="nc.nombres" />
                <input class="input" placeholder="Apellidos" [(ngModel)]="nc.apellidos" />
                <input class="input uppercase" placeholder="NIT o CF" [(ngModel)]="nc.nit" />
                <div class="flex gap-2">
                  <button class="btn-secondary btn-sm" (click)="nuevoCliente.set(false)">
                    Cancelar
                  </button>
                  <button
                    class="btn-primary btn-sm"
                    [disabled]="!nc.nombres.trim()"
                    (click)="registrarCliente()"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            }
            <div>
              <label class="label" for="alumno">Alumno (opcional)</label>
              <input id="alumno" class="input" maxlength="150" [(ngModel)]="alumno" />
            </div>
            <div>
              <label class="label" for="grado">Grado</label>
              <select
                id="grado"
                class="input"
                [ngModel]="gradoId()"
                (ngModelChange)="elegirGrado($event)"
              >
                <option [ngValue]="null">— Sin grado —</option>
                @for (g of grados(); track g.id) {
                  <option [ngValue]="g.id">
                    {{ g.nombre }}{{ comboDe(g.id) ? ' · combo' : '' }}
                  </option>
                }
              </select>
            </div>
          </div>

          <div class="card overflow-x-auto p-0">
            <table class="table">
              <thead>
                <tr>
                  <th>Libro</th>
                  <th class="w-20 text-right">Cant.</th>
                  <th class="w-24 text-right">Precio</th>
                  <th class="w-24 text-right">Subtotal</th>
                  <th>Entrega</th>
                  <th class="w-8"></th>
                </tr>
              </thead>
              <tbody>
                @for (l of lineas(); track l.libroId; let i = $index) {
                  <tr>
                    <td>{{ l.titulo }}</td>
                    <td class="text-right">
                      <input
                        class="input w-16 text-right"
                        type="number"
                        min="1"
                        max="99"
                        [ngModel]="l.cantidad"
                        (ngModelChange)="cambiarCantidad(i, $event)"
                      />
                    </td>
                    <td class="money text-right">{{ precioDe(l.libroId) }}</td>
                    <td class="money text-right">{{ subtotalDe(l.libroId) }}</td>
                    <td class="text-xs">
                      @for (p of planDe(l.libroId); track $index) {
                        <span
                          class="mb-0.5 mr-1 inline-block whitespace-nowrap"
                          [class]="badge(p.estado)"
                        >
                          {{ p.cantidad }} · {{ textoEstado(p.estado)
                          }}{{ p.colegioOrigen ? ' (' + p.colegioOrigen + ')' : '' }}
                        </span>
                      }
                      @if (errorDe(l.libroId); as e) {
                        <span class="text-rose-600 dark:text-rose-400">{{ e }}</span>
                      }
                    </td>
                    <td>
                      <button class="btn-ghost btn-sm" aria-label="Quitar" (click)="quitar(i)">
                        ✕
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="py-6 text-center muted">
                      Elija un grado para cargar su combo o agregue libros
                    </td>
                  </tr>
                }
                <tr>
                  <td colspan="6">
                    <select
                      class="input"
                      aria-label="Agregar libro"
                      (change)="
                        agregar(+$any($event.target).value || null); $any($event.target).value = ''
                      "
                    >
                      <option value="">+ Agregar libro…</option>
                      @for (f of librosDisponibles(); track f.libroId) {
                        <option [value]="f.libroId">{{ f.titulo }} — Q{{ f.precio }}</option>
                      }
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              [ngModel]="entregarAhora()"
              (ngModelChange)="entregarAhora.set($event); cotizar()"
            />
            El cliente se lleva ahora los libros que hay en existencia (si no, quedan reservados)
          </label>
        </div>

        <!-- Columna derecha: totales y cobro -->
        <div class="space-y-4 lg:col-span-2">
          <div class="card space-y-1 text-sm">
            <div class="flex justify-between">
              <span>Suma de libros</span><span class="money">Q{{ cot()?.subtotal ?? '0.00' }}</span>
            </div>
            @if (cot()?.comboAplicado) {
              <div class="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Descuento combo completo</span
                ><span class="money">−Q{{ cot()!.descuento }}</span>
              </div>
            }
            @if (cot()?.pagos; as p) {
              @if (p.recargo !== '0.00') {
                <div class="flex justify-between">
                  <span>Recargo por tarjeta</span><span class="money">Q{{ p.recargo }}</span>
                </div>
              }
            }
            <div
              class="flex justify-between border-t border-zinc-200 pt-2 text-lg font-semibold dark:border-zinc-800"
            >
              <span>Total a cobrar</span
              ><span class="money">Q{{ cot()?.pagos?.total ?? cot()?.aPagar ?? '0.00' }}</span>
            </div>
          </div>

          <div class="card space-y-3">
            <div class="flex items-center justify-between">
              <p class="font-medium">Cobro</p>
              <div class="flex gap-1">
                @for (m of metodos(); track m.id) {
                  <button class="btn-ghost btn-sm" (click)="todoCon(m)">
                    Todo {{ m.nombre.toLowerCase() }}
                  </button>
                }
              </div>
            </div>
            @for (p of pagos(); track $index; let i = $index) {
              <div class="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div class="flex gap-2">
                  <select
                    class="input"
                    aria-label="Método"
                    [ngModel]="p.metodoPagoId"
                    (ngModelChange)="editarPago(i, { metodoPagoId: $event })"
                  >
                    @for (m of metodos(); track m.id) {
                      <option [ngValue]="m.id">
                        {{ m.nombre
                        }}{{ m.recargoPct !== '0.00' ? ' (+' + m.recargoPct + ' %)' : '' }}
                      </option>
                    }
                  </select>
                  <input
                    class="input w-32 text-right"
                    inputmode="decimal"
                    placeholder="Monto"
                    aria-label="Monto"
                    [ngModel]="p.montoBase"
                    (ngModelChange)="editarPago(i, { montoBase: $event })"
                  />
                  @if (pagos().length > 1) {
                    <button
                      class="btn-ghost btn-sm"
                      aria-label="Quitar pago"
                      (click)="quitarPago(i)"
                    >
                      ✕
                    </button>
                  }
                </div>
                @switch (codigo(p.metodoPagoId)) {
                  @case ('EFECTIVO') {
                    <div class="flex items-center gap-2">
                      <input
                        class="input w-32 text-right"
                        inputmode="decimal"
                        placeholder="Recibido"
                        aria-label="Recibido"
                        [ngModel]="p.recibido"
                        (ngModelChange)="editarPago(i, { recibido: $event })"
                      />
                      @if (p.recibido && calc(i)?.vuelto; as v) {
                        <span class="text-sm"
                          >Vuelto: <strong class="money">Q{{ v }}</strong></span
                        >
                      }
                    </div>
                  }
                  @case ('TARJETA') {
                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        class="input w-40"
                        placeholder="Autorización / referencia"
                        aria-label="Referencia"
                        [ngModel]="p.referencia"
                        (ngModelChange)="editarPago(i, { referencia: $event })"
                      />
                      <select
                        class="input w-36"
                        aria-label="Medio"
                        [ngModel]="p.medio"
                        (ngModelChange)="editarPago(i, { medio: $event })"
                      >
                        <option value="">Medio…</option>
                        <option value="TERMINAL">Terminal</option>
                        <option value="LINK_PAGO">Link de pago</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                    @if (calc(i); as c) {
                      <p class="text-sm">
                        Cobrar con tarjeta: <strong class="money">Q{{ c.montoTotal }}</strong>
                        <span class="muted">(incluye recargo Q{{ c.recargo }})</span>
                      </p>
                    }
                  }
                  @default {
                    <input
                      class="input"
                      placeholder="Número de referencia"
                      aria-label="Referencia"
                      [ngModel]="p.referencia"
                      (ngModelChange)="editarPago(i, { referencia: $event })"
                    />
                  }
                }
              </div>
            }
            <div class="flex justify-between">
              <button class="btn-ghost btn-sm" (click)="agregarPago()">
                + Otro método (pago mixto)
              </button>
              @if (faltante() !== '0.00' && faltante() !== null) {
                <button class="btn-ghost btn-sm" (click)="completar()">
                  Completar Q{{ faltante() }}
                </button>
              }
            </div>
            @for (e of erroresVisibles(); track e.error + e.message) {
              <p class="text-sm text-rose-600 dark:text-rose-400">{{ e.message }}</p>
            }
            <button
              class="btn-solid w-full py-3 text-base"
              [disabled]="!puedeCobrar()"
              (click)="cobrar()"
            >
              Cobrar Q{{ cot()?.pagos?.total ?? '0.00' }} (F9)
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class PosComponent implements OnInit, OnDestroy {
  private readonly api = inject(VentasApi);
  private readonly catalogo = inject(CatalogoApi);
  private readonly admin = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly cargando = signal(true);
  readonly procesando = signal(false);
  readonly turno = this.api.turno;

  // Apertura
  readonly cajas = signal<CajaDisponible[]>([]);
  readonly cajaId = signal<number | null>(null);
  readonly denominaciones = signal<Denominacion[]>([]);
  readonly cajaSel = computed(() => this.cajas().find((c) => c.id === this.cajaId()) ?? null);
  conteoApertura: { conteo: Conteo[]; total: string } = { conteo: [], total: '0.00' };
  obsApertura = '';

  // Venta
  private ciclo = new Date().getFullYear();
  readonly grados = signal<Grado[]>([]);
  readonly combos = signal<Combo[]>([]);
  readonly precios = signal<FilaPrecio[]>([]);
  readonly gradoId = signal<number | null>(null);
  readonly comboId = signal<number | null>(null);
  readonly lineas = signal<Linea[]>([]);
  readonly entregarAhora = signal(true);
  readonly pagos = signal<PagoForm[]>([]);
  readonly cot = signal<Cotizacion | null>(null);
  readonly cotizando = signal(false);
  readonly comprobante = signal<Venta | null>(null);
  alumno = '';

  readonly cliente = signal<Persona | null>(null);
  private consumidorFinal: Persona | null = null;
  readonly busquedaCliente = signal('');
  readonly resultadosCliente = signal<Persona[]>([]);
  readonly nuevoCliente = signal(false);
  nc = { nombres: '', apellidos: '', nit: 'CF' };
  private timerCliente?: ReturnType<typeof setTimeout>;

  private readonly cotizar$ = new Subject<void>();
  private sub?: Subscription;

  readonly metodos = computed<Metodo[]>(() => this.cot()?.metodos ?? []);
  readonly librosDisponibles = computed(() => {
    const usados = new Set(this.lineas().map((l) => l.libroId));
    return this.precios().filter((f) => f.precio !== null && !usados.has(f.libroId));
  });
  readonly faltante = computed(() => this.cot()?.pagos?.faltante ?? null);
  /** Mientras falte dinero, "no cuadra" se muestra como ayuda en el botón Completar, no como error. */
  readonly erroresVisibles = computed(() => {
    const e = this.cot()?.errores ?? [];
    return this.pagos().some((p) => p.montoBase)
      ? e
      : e.filter((x) => x.error !== 'PAGOS_NO_CUADRAN');
  });
  readonly puedeCobrar = computed(
    () =>
      !this.procesando() &&
      !this.cotizando() &&
      this.lineas().length > 0 &&
      !!this.cot()?.pagos &&
      this.cot()!.errores.length === 0,
  );

  ngOnInit() {
    this.sub = this.cotizar$
      .pipe(
        debounceTime(250),
        switchMap(() => {
          if (!this.lineas().length) {
            this.cotizando.set(false);
            return of(null);
          }
          return this.api.cotizar(this.input()).pipe(
            catchError((e) => {
              this.toast.error(mensajeError(e));
              return of(null);
            }),
          );
        }),
      )
      .subscribe((c) => {
        this.cot.set(c);
        this.cotizando.set(false);
      });
    this.api.denominaciones().subscribe((d) => this.denominaciones.set(d));
    this.cargarTurno();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  @HostListener('window:keydown', ['$event'])
  atajos(e: KeyboardEvent) {
    if (!this.turno()) return;
    if (e.key === 'F9') {
      e.preventDefault();
      if (this.puedeCobrar()) this.cobrar();
    } else if (e.key === 'F2') {
      e.preventDefault();
      this.nuevaVenta();
    }
  }

  private cargarTurno() {
    this.cargando.set(true);
    this.api.turnoActual().subscribe({
      next: (r) => {
        const t = r.turno;
        if (t?.estado === 'EN_CIERRE') {
          this.router.navigate(['/pos/cierre']);
          return;
        }
        if (!t)
          this.api.cajasDisponibles().subscribe((c) => {
            this.cajas.set(c);
            if (c.length === 1) this.cajaId.set(c[0].id);
          });
        else this.prepararVenta(t.colegioId);
        this.cargando.set(false);
      },
      error: (e) => {
        this.toast.error(mensajeError(e));
        this.cargando.set(false);
      },
    });
  }

  fondoNormal(v: string) {
    return Number(v).toFixed(2);
  }

  abrir() {
    const caja = this.cajaSel();
    if (!caja) return;
    this.procesando.set(true);
    this.api
      .abrirTurno({
        cajaId: caja.id,
        conteo: this.conteoApertura.conteo,
        observacion: this.obsApertura.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.toast.ok(`Turno abierto en Caja ${caja.numero}`);
          this.procesando.set(false);
          this.cargarTurno();
        },
        error: (e) => {
          this.toast.error(mensajeError(e));
          this.procesando.set(false);
        },
      });
  }

  private prepararVenta(colegioId: number) {
    this.catalogo.grados().subscribe((g) => this.grados.set(g.filter((x) => x.activo)));
    this.catalogo.cicloActual().subscribe((ciclo) => {
      this.ciclo = ciclo;
      this.catalogo
        .combos(colegioId, ciclo)
        .subscribe((c) => this.combos.set(c.filter((x) => x.activo)));
      this.catalogo.precios(colegioId, ciclo).subscribe((p) => this.precios.set(p.items));
    });
    this.admin.personas('consumidor final', 1, 5).subscribe((r) => {
      this.consumidorFinal = r.data.find((p) => p.nit === 'CF') ?? null;
    });
    this.nuevaVenta();
  }

  nuevaVenta() {
    this.comprobante.set(null);
    this.lineas.set([]);
    this.gradoId.set(null);
    this.comboId.set(null);
    this.entregarAhora.set(true);
    this.alumno = '';
    this.cliente.set(null);
    this.busquedaCliente.set('');
    this.resultadosCliente.set([]);
    this.pagos.set([]);
    this.cot.set(null);
  }

  // ---------- cliente ----------
  buscarCliente(q: string) {
    this.busquedaCliente.set(q);
    clearTimeout(this.timerCliente);
    if (!q.trim()) {
      this.resultadosCliente.set([]);
      return;
    }
    this.timerCliente = setTimeout(
      () =>
        this.admin.personas(q.trim(), 1, 8).subscribe((r) => this.resultadosCliente.set(r.data)),
      250,
    );
  }
  elegirCliente(p: Persona) {
    this.cliente.set(p);
    this.resultadosCliente.set([]);
    this.busquedaCliente.set('');
  }
  registrarCliente() {
    this.admin
      .crearPersona({
        nombres: this.nc.nombres.trim(),
        apellidos: this.nc.apellidos.trim(),
        nit: this.nc.nit.trim() || 'CF',
      })
      .subscribe({
        next: (p) => {
          this.elegirCliente(p);
          this.nuevoCliente.set(false);
          this.nc = { nombres: '', apellidos: '', nit: 'CF' };
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }

  // ---------- libros ----------
  comboDe(gradoId: number) {
    return this.combos().find((c) => c.gradoId === gradoId) ?? null;
  }
  elegirGrado(gradoId: number | null) {
    this.gradoId.set(gradoId);
    const combo = gradoId ? this.comboDe(gradoId) : null;
    this.comboId.set(combo?.id ?? null);
    if (combo) {
      this.lineas.set(
        combo.libros.map((l) => ({ libroId: l.libroId, titulo: l.titulo, cantidad: l.cantidad })),
      );
      this.cotizar(true);
    }
  }
  agregar(libroId: number | null) {
    const f = this.precios().find((x) => x.libroId === libroId);
    if (!f) return;
    this.lineas.update((ls) => [...ls, { libroId: f.libroId, titulo: f.titulo, cantidad: 1 }]);
    this.cotizar(true);
  }
  quitar(i: number) {
    this.lineas.update((ls) => ls.filter((_, j) => j !== i));
    this.cotizar(true);
  }
  cambiarCantidad(i: number, v: number) {
    const n = Math.min(99, Math.max(1, Math.floor(Number(v) || 1)));
    this.lineas.update((ls) => ls.map((l, j) => (j === i ? { ...l, cantidad: n } : l)));
    this.cotizar(true);
  }
  planDe(libroId: number) {
    return (this.cot()?.lineas ?? []).filter((l) => l.libroId === libroId && l.estado);
  }
  errorDe(libroId: number) {
    return this.cot()?.lineas.find((l) => l.libroId === libroId && l.error)?.error ?? null;
  }
  precioDe(libroId: number) {
    return this.cot()?.lineas.find((l) => l.libroId === libroId)?.precio ?? '…';
  }
  subtotalDe(libroId: number) {
    const ls = this.planDe(libroId);
    if (!ls.length) return '…';
    // Solo para mostrar: suma de subtotales calculados por el backend.
    return (ls.reduce((a, l) => a + Math.round(Number(l.subtotal) * 100), 0) / 100).toFixed(2);
  }
  textoEstado(e: string | null) {
    return e ? (ESTADO_LINEA[e as keyof typeof ESTADO_LINEA]?.texto ?? e) : '';
  }
  badge(e: string | null) {
    return e ? (ESTADO_LINEA[e as keyof typeof ESTADO_LINEA]?.clase ?? 'badge') : 'badge';
  }

  // ---------- cobro ----------
  codigo(metodoId: number) {
    return this.metodos().find((m) => m.id === metodoId)?.codigo ?? '';
  }
  calc(i: number) {
    return this.cot()?.pagos?.pagos[i] ?? null;
  }
  todoCon(m: Metodo) {
    const aPagar = this.cot()?.aPagar;
    if (!aPagar) return;
    this.pagos.set([
      { metodoPagoId: m.id, montoBase: aPagar, recibido: '', referencia: '', medio: '' },
    ]);
    this.cotizar();
  }
  agregarPago() {
    const usado = new Set(this.pagos().map((p) => p.metodoPagoId));
    const m = this.metodos().find((x) => !usado.has(x.id)) ?? this.metodos()[0];
    if (!m) return;
    this.pagos.update((ps) => [
      ...ps,
      { metodoPagoId: m.id, montoBase: '', recibido: '', referencia: '', medio: '' },
    ]);
  }
  quitarPago(i: number) {
    this.pagos.update((ps) => ps.filter((_, j) => j !== i));
    this.cotizar();
  }
  editarPago(i: number, cambio: Partial<PagoForm>) {
    this.pagos.update((ps) => ps.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
    this.cotizar();
  }
  /** Pone en el último pago lo que falta (usa el faltante calculado por el backend). */
  completar() {
    const f = this.faltante();
    const ps = this.pagos();
    if (!f || !ps.length) return;
    const i = ps.length - 1;
    const actual = Math.round(Number(ps[i].montoBase || 0) * 100);
    const nuevo = (actual + Math.round(Number(f) * 100)) / 100;
    this.editarPago(i, { montoBase: nuevo > 0 ? nuevo.toFixed(2) : '' });
  }

  private input() {
    const recargo = new Map(this.metodos().map((m) => [m.id, m.recargoPct]));
    const pagos: PagoEntrada[] = this.pagos()
      .filter((p) => p.montoBase)
      .map((p) => ({
        metodoPagoId: p.metodoPagoId,
        montoBase: p.montoBase,
        ...(p.recibido ? { recibido: p.recibido } : {}),
        ...(p.referencia.trim() ? { referencia: p.referencia.trim() } : {}),
        ...(p.medio ? { medio: p.medio } : {}),
        // Recargo que el cajero está viendo; si cambió, el backend avisa (RECARGO_CAMBIO).
        ...(recargo.has(p.metodoPagoId) ? { recargoPct: recargo.get(p.metodoPagoId) } : {}),
      }));
    return {
      comboId: this.comboId() ?? undefined,
      lineas: this.lineas().map((l) => ({ libroId: l.libroId, cantidad: l.cantidad })),
      entregarAhora: this.entregarAhora(),
      pagos: this.pagos().length ? pagos : undefined,
    };
  }

  /**
   * Pide la cotización al backend (con espera de 250 ms entre cambios).
   * Si cambiaron los libros y hay un solo pago (o ninguno), ese pago se ajusta al nuevo total.
   */
  cotizar(lineasCambiaron = false) {
    this.cotizando.set(true);
    if (lineasCambiaron && this.pagos().length <= 1 && this.lineas().length) {
      this.api.cotizar({ ...this.input(), pagos: undefined }).subscribe({
        next: (c) => {
          const actual = this.pagos()[0];
          const metodoId =
            actual?.metodoPagoId ?? c.metodos.find((m) => m.codigo === 'EFECTIVO')?.id;
          if (metodoId)
            this.pagos.set([
              {
                ...(actual ?? { recibido: '', referencia: '', medio: '' }),
                metodoPagoId: metodoId,
                montoBase: c.aPagar,
              },
            ]);
          this.cotizar$.next();
        },
        error: (e) => {
          this.toast.error(mensajeError(e));
          this.cotizando.set(false);
        },
      });
      return;
    }
    this.cotizar$.next();
  }

  cobrar() {
    const cliente = this.cliente() ?? this.consumidorFinal;
    if (!cliente) {
      this.toast.error('Elija un cliente');
      return;
    }
    this.procesando.set(true);
    this.api
      .crearVenta({
        ...this.input(),
        clienteId: cliente.id,
        alumno: this.alumno.trim() || undefined,
        gradoId: this.gradoId() ?? undefined,
      })
      .subscribe({
        next: (v) => {
          this.procesando.set(false);
          this.comprobante.set(v);
          this.toast.ok(`Venta ${v.codigo} registrada`);
          // Refresca existencias/precios para la siguiente venta.
          this.catalogo
            .precios(v.colegioId, this.ciclo)
            .subscribe((p) => this.precios.set(p.items));
        },
        error: (e) => {
          this.procesando.set(false);
          this.toast.error(mensajeError(e));
          // CU-05 A2 / CU-04 A3: recargo o stock cambió → se recalcula y se avisa.
          this.cotizar();
        },
      });
  }

  imprimir() {
    window.print();
  }
}
