import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="card flex items-start justify-between gap-3 bg-white text-sm shadow-sm dark:bg-zinc-900"
          [class.border-emerald-500]="t.tipo === 'ok'"
          [class.border-rose-500]="t.tipo === 'error'"
        >
          <span>{{ t.texto }}</span>
          <button
            class="text-zinc-400 hover:text-zinc-600"
            (click)="toast.cerrar(t.id)"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastsComponent {
  readonly toast = inject(ToastService);
}
