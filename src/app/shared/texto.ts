/** Minúsculas y sin tildes, igual que f_norm en la BD: "María" → "maria". */
export const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
