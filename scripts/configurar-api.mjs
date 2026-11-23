// Antes del build de producción: escribe la URL de la API (variable API_URL) en
// environment.prod.ts y en la CSP de public/_headers (connect-src), para que ambos coincidan.
// Sin API_URL deja los archivos como están.
//   API_URL=https://intelecto-backend.onrender.com npm run build:cloudflare
import { readFileSync, writeFileSync } from 'node:fs';

const crudo = process.env.API_URL?.trim();
if (!crudo) {
  console.log('API_URL no definida: se usa la URL que ya está en environment.prod.ts');
  process.exit(0);
}
let url;
try {
  url = new URL(crudo);
} catch {
  console.error(`API_URL inválida: ${crudo}`);
  process.exit(1);
}
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
  console.error('API_URL debe ser https://dominio (sin usuario, parámetros ni #)');
  process.exit(1);
}
const origen = url.origin; // https://host[:puerto]
const api = `${origen}/api/v1`;

const env = 'src/environments/environment.prod.ts';
const e = readFileSync(env, 'utf8');
const e2 = e.replace(/apiUrl:\s*'[^']*'/, `apiUrl: '${api}'`);
if (e2 === e && !e.includes(`'${api}'`)) {
  console.error(`No encontré apiUrl en ${env}`);
  process.exit(1);
}
writeFileSync(env, e2);

const cab = 'public/_headers';
const h = readFileSync(cab, 'utf8');
const h2 = h.replace(/connect-src 'self'[^;]*;/, `connect-src 'self' ${origen};`);
if (!/connect-src 'self' [^;]+;/.test(h2)) {
  console.error(`No encontré connect-src en ${cab}`);
  process.exit(1);
}
writeFileSync(cab, h2);
console.log(`API configurada: ${api} (environment.prod.ts y CSP connect-src)`);
