# Solo para correr el frontend en local con Docker. En producción se usa Cloudflare Pages.
FROM node:24.22.3-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG CONFIG=production
RUN npx ng build --configuration $CONFIG

# Imagen nginx sin root (escucha en 8080).
FROM nginxinc/nginx-unprivileged:1.30.6-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/intelecto-frontend/browser /usr/share/nginx/html
EXPOSE 8080
