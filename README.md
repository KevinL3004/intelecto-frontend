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
Guía completa: `DESPLIEGUE.md` del backend. Resumen:

| Campo | Valor |
|---|---|
| Build command | `npm run build:cloudflare` |
| Output | `dist/intelecto-frontend/browser` |
| Variables | `API_URL=https://<api>.onrender.com` · `NODE_VERSION=22.23.5` |

`build:cloudflare` escribe `API_URL` en `environment.prod.ts` **y** en la CSP de
`public/_headers` (`connect-src`), así nunca quedan distintas. `_redirects` trae la regla SPA.

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
