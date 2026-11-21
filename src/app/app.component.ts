import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastsComponent } from './core/ui/toasts.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastsComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<router-outlet /><app-toasts />`,
})
export class AppComponent {}
