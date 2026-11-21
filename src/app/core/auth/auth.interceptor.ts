import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const conToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

const SIN_REINTENTO = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Agrega el access token SOLO a peticiones hacia nuestra API (nunca a otros dominios) y,
 * si vence (401), renueva la sesión una sola vez. Las peticiones simultáneas comparten el
 * mismo refresh: el backend revoca la sesión si un refresh token se usa dos veces.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const sinReintento = SIN_REINTENTO.some((p) => req.url.includes(p));
  const propia = req.headers.has('Authorization');
  const salida = sinReintento || propia ? req : conToken(req, auth.accessToken);

  return next(salida).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || sinReintento || propia || !auth.refreshToken) {
        if (err.status === 401 && !sinReintento && !propia) auth.logout(false);
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        switchMap(() => next(conToken(req, auth.accessToken))),
        catchError((e) => {
          auth.logout(false);
          return throwError(() => e);
        }),
      );
    }),
  );
};
