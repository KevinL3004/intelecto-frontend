import { Pipe, PipeTransform } from '@angular/core';

/** "-30.00" → "−Q30.00"; "125.5" → "Q125.50". Solo formato; los montos vienen del backend. */
@Pipe({ name: 'quetzal', standalone: true })
export class QuetzalPipe implements PipeTransform {
  transform(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === '') return '—';
    const s = String(v).trim();
    const neg = s.startsWith('-');
    const n = neg ? s.slice(1) : s;
    const txt = /^\d+(\.\d+)?$/.test(n) ? Number(n).toFixed(2) : n;
    return `${neg ? '−' : ''}Q${txt}`;
  }
}
