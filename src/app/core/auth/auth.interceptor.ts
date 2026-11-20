import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const conToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/** Agrega el access token y, si vence (401), intenta un refresh una sola vez. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const esAuth = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

  return next(esAuth ? req : conToken(req, auth.accessToken)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || esAuth || !auth.refreshToken) return throwError(() => err);
      return auth.refresh().pipe(
        switchMap(() => next(conToken(req, auth.accessToken))),
        catchError((e) => {
          auth.logout();
          return throwError(() => e);
        }),
      );
    }),
  );
};
