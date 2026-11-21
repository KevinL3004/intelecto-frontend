import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/ui/toast.service';
import { mensajeError } from '../../../core/http/api-error';

interface MetodoPago {
  id: number;
  codigo: string;
  nombre: string;
  recargoPct: string;
  requiereReferencia: boolean;
}

/** RN-01: solo el Administrador edita el recargo; aplica en tiempo real a ventas nuevas. */
@Component({
    selector: 'app-metodos-pago',
    imports: [FormsModule],
    template: `
    <h1 class="page-title">Métodos de pago</h1>
    <p class="muted mb-4">El recargo se aplica solo sobre el monto cobrado con ese método.</p>
    <div class="card overflow-x-auto p-0">
      <table class="table">
        <thead>
          <tr>
            <th>Método</th>
            <th>Requiere referencia</th>
            <th class="text-right">Recargo</th>
            @if (esAdmin) {
              <th></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (m of items(); track m.id) {
            <tr>
              <td>{{ m.nombre }}</td>
              <td>{{ m.requiereReferencia ? 'Sí' : 'No' }}</td>
              <td class="money text-right">
                @if (editId() === m.id) {
                  <input
                    class="input w-24 text-right"
                    type="number"
                    min="0"
                    max="15"
                    step="0.01"
                    [(ngModel)]="valor"
                  />
                } @else {
                  {{ m.recargoPct }} %
                }
              </td>
              @if (esAdmin) {
                <td class="text-right">
                  @if (editId() === m.id) {
                    <button class="btn-ghost btn-sm" (click)="editId.set(null)">Cancelar</button>
                    <button class="btn-primary btn-sm" (click)="guardar(m)">Guardar</button>
                  } @else {
                    <button class="btn-ghost btn-sm" (click)="editar(m)">Editar</button>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class MetodosPagoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly url = `${environment.apiUrl}/metodos-pago`;
  readonly esAdmin = inject(AuthService).tieneRol('ADMIN');
  readonly items = signal<MetodoPago[]>([]);
  readonly editId = signal<number | null>(null);
  valor = 0;

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.http.get<MetodoPago[]>(this.url).subscribe((r) => this.items.set(r));
  }

  editar(m: MetodoPago) {
    this.valor = Number(m.recargoPct);
    this.editId.set(m.id);
  }

  guardar(m: MetodoPago) {
    if (
      !confirm(
        `¿Cambiar el recargo de ${m.nombre} a ${this.valor} %? Aplica de inmediato a todas las ventas nuevas.`,
      )
    )
      return;
    this.http.patch(`${this.url}/${m.id}/recargo`, { recargoPct: this.valor }).subscribe({
      next: () => {
        this.toast.ok('Recargo actualizado');
        this.editId.set(null);
        this.cargar();
      },
      error: (e) => this.toast.error(mensajeError(e)),
    });
  }
}
