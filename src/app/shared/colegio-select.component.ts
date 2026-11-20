import { Component, inject, model, OnInit, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { Colegio, ColegiosService } from '../features/admin/colegios/colegios.service';

const K_COLEGIO = 'svi.colegioSeleccionado';

/**
 * Selector de colegio para pantallas por colegio.
 * El cajero queda fijo en su colegio; Admin y Contador eligen (se recuerda la última elección).
 */
@Component({
  selector: 'app-colegio-select',
  standalone: true,
  template: `
    @if (fijo) {
      <span class="input inline-flex w-auto items-center">{{ nombreFijo }}</span>
    } @else {
      <select
        class="input w-56"
        aria-label="Colegio"
        [value]="colegioId() ?? ''"
        (change)="elegir($any($event.target).value)"
      >
        <option value="" disabled>Seleccione colegio</option>
        @for (c of colegios(); track c.id) {
          <option [value]="c.id">{{ c.nombre }}</option>
        }
      </select>
    }
  `,
})
export class ColegioSelectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly service = inject(ColegiosService);
  readonly colegioId = model<number | null>(null);
  readonly colegios = signal<Colegio[]>([]);
  private readonly u = this.auth.usuario();
  readonly fijo = this.u?.rol === 'CAJERO' && !!this.u?.colegioId;
  readonly nombreFijo = this.u?.colegio ?? 'Mi colegio';

  ngOnInit() {
    if (this.fijo) {
      this.colegioId.set(this.u!.colegioId);
      return;
    }
    this.service.listar('', 1, 200).subscribe((r) => {
      const activos = r.data.filter((c) => c.activo);
      this.colegios.set(activos);
      const guardado = Number(this.leer());
      const inicial = activos.find((c) => c.id === guardado) ?? activos[0];
      if (inicial && !this.colegioId()) this.colegioId.set(inicial.id);
    });
  }

  elegir(v: string) {
    const id = Number(v) || null;
    this.colegioId.set(id);
    try {
      if (id) localStorage.setItem(K_COLEGIO, String(id));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private leer() {
    try {
      return localStorage.getItem(K_COLEGIO);
    } catch {
      return null;
    }
  }
}
