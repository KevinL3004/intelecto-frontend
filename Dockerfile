# Solo para correr el frontend en local con Docker. En producción se usa Cloudflare Pages.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG CONFIG=production
RUN npx ng build --configuration $CONFIG

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/intelecto-frontend/browser /usr/share/nginx/html
EXPOSE 80
