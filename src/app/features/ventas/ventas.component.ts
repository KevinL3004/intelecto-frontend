import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { FilaVenta, VentasApi } from '../../core/ventas/ventas.api';

const ENTREGA: Record<string, string> = {
  COMPLETA: 'badge-ok',
  PARCIAL: 'badge-warn',
  PENDIENTE: 'badge-warn',
};

/** Ventas (R-01). Con ?pendientes=1 lista lo que falta entregar (CU-10). */
@Component({
  selector: 'app-ventas',
  imports: [DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="page-title">
          {{ pendientes() ? 'Entregas pendientes' : esCajero ? 'Mis ventas' : 'Ventas' }}
        </h1>
        <p class="muted">{{ total() }} ventas</p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <input
          class="input w-64"
          placeholder="Código, cliente, NIT o alumno"
          [(ngModel)]="q"
          (ngModelChange)="buscar()"
        />
        @if (!pendientes()) {
          <input
            class="input w-36"
            type="date"
            aria-label="Desde"
            [(ngModel)]="desde"
            (change)="cargar()"
          />
          <input
            class="input w-36"
            type="date"
            aria-label="Hasta"
            [(ngModel)]="hasta"
            (change)="cargar()"
          />
          <select
            class="input w-32"
            aria-label="Estado"
            [(ngModel)]="estadoPago"
            (change)="cargar()"
          >
            <option value="">Todas</option>
            <option value="PAGADA">Pagadas</option>
            <option value="ANULADA">Anuladas</option>
          </select>
        }
      </div>
    </div>
    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Alumno</th>
            @if (!esCajero) {
              <th>Colegio</th>
              <th>Usuario</th>
            }
            <th class="text-right">Total</th>
            <th>Entrega</th>
          </tr>
        </thead>
        <tbody>
          @for (v of items(); track v.id) {
            <tr
              class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
              [routerLink]="['/ventas', v.id]"
            >
              <td class="font-mono text-xs">
                {{ v.codigo }}
                @if (v.estadoPago === 'ANULADA') {
                  <span class="badge-off ml-1">Anulada</span>
                }
              </td>
              <td class="whitespace-nowrap">{{ v.fecha | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>
                {{ v.cliente }} <span class="muted font-mono text-xs">{{ v.nit }}</span>
              </td>
              <td>{{ v.alumno || '—' }}</td>
              @if (!esCajero) {
                <td>{{ v.colegio }}</td>
                <td>{{ v.usuario }}</td>
              }
              <td class="money text-right">{{ v.total }}</td>
              <td>
                <span [class]="clase(v.estadoEntrega)">{{ v.estadoEntrega }}</span>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="py-8 text-center muted">Sin ventas</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (total() > limit) {
      <div class="mt-3 flex items-center justify-end gap-2">
        <button class="btn-secondary btn-sm" [disabled]="page === 1" (click)="irA(page - 1)">
          Anterior
        </button>
        <span class="muted">Página {{ page }}</span>
        <button
          class="btn-secondary btn-sm"
          [disabled]="page * limit >= total()"
          (click)="irA(page + 1)"
        >
          Siguiente
        </button>
      </div>
    }
  `,
})
export class VentasComponent implements OnInit {
  private readonly api = inject(VentasApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  readonly esCajero = inject(AuthService).tieneRol('CAJERO');
  readonly items = signal<FilaVenta[]>([]);
  readonly total = signal(0);
  readonly pendientes = signal(false);
  readonly limit = 30;
  page = 1;
  q = '';
  desde = '';
  hasta = '';
  estadoPago = '';
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit() {
    this.route.queryParamMap.subscribe((p) => {
      this.pendientes.set(p.get('pendientes') === '1');
      this.page = 1;
      this.cargar();
    });
  }

  clase(e: string) {
    return ENTREGA[e] ?? 'badge';
  }

  buscar() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.page = 1;
      this.cargar();
    }, 300);
  }

  irA(p: number) {
    this.page = p;
    this.cargar();
  }

  cargar() {
    this.api
      .ventas({
        q: this.q.trim() || undefined,
        pendientesEntrega: this.pendientes(),
        desde: this.desde || undefined,
        hasta: this.hasta || undefined,
        estadoPago: this.estadoPago || undefined,
        page: this.page,
        limit: this.limit,
      })
      .subscribe({
        next: (r) => {
          this.items.set(r.data);
          this.total.set(r.total);
        },
        error: (e) => this.toast.error(mensajeError(e)),
      });
  }
}
