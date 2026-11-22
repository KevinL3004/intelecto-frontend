/** Utilidades de escala para las gráficas SVG. */

/** Máximo "limpio" del eje y sus marcas (1, 2, 2.5, 5 × 10^n). */
export function marcas(max: number, cuantas = 4): number[] {
  if (max <= 0) return [0, 1];
  const paso0 = max / cuantas;
  const pot = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= paso0) ?? 10 * pot;
  const tope = Math.ceil(max / paso) * paso;
  const r: number[] = [];
  for (let v = 0; v <= tope + paso / 2; v += paso) r.push(Math.round(v * 100) / 100);
  return r;
}

/** Q compacto para ejes: Q950, Q12K, Q1.2M. */
export function qCompacto(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `Q${(v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 10_000) return `Q${Math.round(v / 1000)}K`;
  if (a >= 1000) return `Q${(v / 1000).toFixed(1)}K`;
  return `Q${Math.round(v)}`;
}

export const qCompleto = (v: number | string) =>
  'Q' + Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** dd/MM a partir de YYYY-MM-DD (sin zonas horarias de por medio). */
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const diaSemana = (iso: string) => DIAS[new Date(iso + 'T12:00:00').getDay()];
