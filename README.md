# intelecto-frontend

Frontend del Sistema de Ventas Intelecto (Angular 22 standalone + Tailwind CSS 3).

## Desarrollo
Requiere **Node 22.12+** (`nvm use`, ver `.nvmrc`).
```bash
npm ci --ignore-scripts
npm start            # http://localhost:4200 (API en http://localhost:3000)
```

## Estándar de UI (no inventar estilos sueltos)
Las clases base están en `src/styles.css`:

| Clase | Uso |
|---|---|
| `btn-primary` | Acción principal (outline acento) |
| `btn-secondary` | Acción secundaria (outline gris) |
| `btn-danger` | Acción destructiva (outline rojo) |
| `btn-solid` | Solo para **Cobrar** en el POS |
| `btn-ghost`, `btn-sm` | Acciones de tabla / tamaño pequeño |
| `input`, `label`, `field-error` | Formularios |
| `card`, `table`, `badge-ok/warn/off`, `money` | Contenedores, tablas, estados, montos |

- Modo oscuro: `darkMode: 'class'`, lo maneja `ThemeService` (claro → oscuro → sistema).
- Color de acento: `tailwind.config.js` → `accent`.
- Nuevo mantenimiento: copiar `features/admin/colegios` y agregar la ruta en `app.routes.ts` y en `layout/menu.ts`.

## Producción (Cloudflare Pages)
1. Poner la URL de Render en `src/environments/environment.prod.ts`.
2. Cloudflare Pages → conectar repo → Build command: `npx ng build` · Output: `dist/intelecto-frontend/browser`.
3. Variable de entorno en Cloudflare: `NODE_VERSION=22.23.5` (o superior).
4. `public/_redirects` ya incluye la regla SPA.
5. `public/_headers` aplica las cabeceras de seguridad (CSP, HSTS, etc.). **Si cambia la URL de
   la API, actualizar `connect-src`** en ese archivo o el navegador bloqueará las peticiones.

## Seguridad
- Sesión en `sessionStorage` (termina al cerrar la pestaña); "Salir" revoca la sesión en el servidor.
- El token solo se envía a la URL de la API; la renovación es única aunque fallen varias peticiones a la vez
  (el backend revoca la sesión si un refresh token se usa dos veces).
- CSP estricta: sin scripts en línea (por eso `tema.js` es un archivo aparte y está desactivado
  `inlineCritical` en `angular.json`). No usar `innerHTML` ni `bypassSecurityTrust*`.
- La política de contraseñas de `shared/password.ts` replica la del backend (que es la que manda).
- Política completa: ver `SECURITY.md` del backend.

## Docker (local, opcional)
```bash
docker compose up -d --build   # http://localhost:4200
```
