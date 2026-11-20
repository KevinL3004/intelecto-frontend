import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Rol } from './auth.models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() || inject(Router).createUrlTree(['/login']);
};

/** Obliga a cambiar la contraseña temporal antes de usar el sistema. */
export const passwordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return (
    !auth.usuario()?.debeCambiarPassword || inject(Router).createUrlTree(['/cambiar-password'])
  );
};

/** Solo oculta navegación: el backend vuelve a validar el rol. */
export const roleGuard =
  (...roles: Rol[]): CanActivateFn =>
  () =>
    inject(AuthService).tieneRol(...roles) || inject(Router).createUrlTree(['/inicio']);
