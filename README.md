# intelecto-frontend

Frontend del Sistema de Ventas Intelecto (Angular 18 standalone + Tailwind CSS 3).

## Desarrollo
```bash
npm install
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
3. `public/_redirects` ya incluye la regla SPA.

## Docker (local, opcional)
```bash
docker compose up -d --build   # http://localhost:4200
```
