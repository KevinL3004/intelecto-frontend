import { QuetzalPipe } from '../../shared/quetzal.pipe';
import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { mensajeError } from '../../core/http/api-error';
import { ESTADO_TURNO, EstadoTurno, FilaTurno, VentasApi } from '../../core/ventas/ventas.api';

/** Turnos y cierres (R-07). Admin/Contador ven todos; el cajero solo los suyos. */
@Component({
  selector: 'app-turnos',
  standalone: true,
  imports: [QuetzalPipe, DatePipe, RouterLink],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="page-title">Turnos de caja</h1>
        <p class="muted">{{ total() }} turnos</p>
      </div>
      <select class="input w-56" aria-label="Estado" (change)="filtrar($any($event.target).value)">
        <option value="">Todos los estados</option>
        @for (e of estados; track e) {
          <option [value]="e" [selected]="e === estado">{{ etiqueta(e).texto }}</option>
        }
      </select>
    </div>
    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Caja</th>
            <th>Cajero</th>
            <th>Apertura</th>
            <th>Cierre</th>
            <th class="text-right">Esperado</th>
            <th class="text-right">Contado</th>
            <th class="text-right">Diferencia</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          @for (t of items(); track t.id) {
            <tr
              class="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
              [routerLink]="['/turnos', t.id]"
            >
              <td class="font-mono text-xs">{{ t.id }}</td>
              <td>Caja {{ t.cajaNumero }} · {{ t.colegio }}</td>
              <td>{{ t.cajero }}</td>
              <td class="whitespace-nowrap">{{ t.abiertoEn | date: 'dd/MM HH:mm' }}</td>
              <td class="whitespace-nowrap">
                {{ t.cerradoEn ? (t.cerradoEn | date: 'dd/MM HH:mm') : '—' }}
              </td>
              <td class="money text-right">{{ t.efectivoEsperado ?? '—' }}</td>
              <td class="money text-right">{{ t.efectivoContado ?? '—' }}</td>
              <td
                class="money text-right"
                [class.text-rose-600]="t.diferencia && t.diferencia !== '0.00'"
              >
                {{ t.diferencia | quetzal }}
              </td>
              <td class="whitespace-nowrap">
                <span [class]="etiqueta(t.estado).clase">{{ etiqueta(t.estado).texto }}</span>
                @if (t.forzado) {
                  <span class="badge-off ml-1">Forzado</span>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9" class="py-8 text-center muted">Sin turnos</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TurnosComponent implements OnInit {
  private readonly api = inject(VentasApi);
  private readonly toast = inject(ToastService);
  readonly estados: EstadoTurno[] = ['ABIERTO', 'EN_CIERRE', 'CERRADO', 'VALIDADO', 'OBSERVADO'];
  readonly items = signal<FilaTurno[]>([]);
  readonly total = signal(0);
  /** Admin y Contador entran directo a los cierres por validar. */
  estado = inject(AuthService).tieneRol('ADMIN', 'CONTADOR') ? 'CERRADO' : '';

  ngOnInit() {
    this.cargar();
  }
  etiqueta(e: EstadoTurno) {
    return ESTADO_TURNO[e];
  }
  filtrar(e: string) {
    this.estado = e;
    this.cargar();
  }
  cargar() {
    this.api.turnos({ estado: this.estado || undefined, limit: 100 }).subscribe({
      next: (r) => {
        this.items.set(r.data);
        this.total.set(r.total);
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
