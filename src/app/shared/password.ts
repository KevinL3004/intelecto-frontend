import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Misma política que el backend (src/common/utils/password.ts). El backend es quien decide;
 * esto solo avisa antes de enviar.
 */
export const PASSWORD_MIN = 12;
const PASSWORD_MAX_BYTES = 72;
const COMUNES = [
  'password',
  'contrasena',
  'contraseña',
  'qwerty',
  'asdfgh',
  'zxcvbn',
  '123456',
  '654321',
  'abc123',
  'iloveyou',
  'admin',
  'administrador',
  'bienvenido',
  'welcome',
  'guatemala',
  'intelecto',
  'cambiar',
  'temporal',
  'prueba',
  'letmein',
  'monkey',
  'dragon',
  'football',
  'futbol',
];

export const AYUDA_PASSWORD =
  `Mínimo ${PASSWORD_MIN} caracteres, con mayúscula, minúscula y número. ` +
  'Sin palabras comunes, el nombre del sistema ni el usuario.';

export function problemasPassword(p: string, usuario?: string | null): string[] {
  const r: string[] = [];
  if (!p) return r;
  if (p.length < PASSWORD_MIN) r.push(`al menos ${PASSWORD_MIN} caracteres`);
  if (new TextEncoder().encode(p).length > PASSWORD_MAX_BYTES) r.push('es demasiado larga');
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p))
    r.push('mayúscula, minúscula y número');
  const baja = p.toLowerCase();
  if (COMUNES.some((c) => baja.includes(c)))
    r.push('sin palabras comunes ni el nombre del sistema');
  if (usuario && usuario.length >= 3 && baja.includes(usuario.toLowerCase()))
    r.push('sin el nombre de usuario');
  if (/(.)\1{3,}/.test(p)) r.push('sin repetir un carácter 4 veces seguidas');
  return r;
}

/** Validador de formulario; `usuario` permite leer el nombre de usuario del mismo formulario. */
export const passwordSegura =
  (usuario?: () => string | null | undefined): ValidatorFn =>
  (c: AbstractControl): ValidationErrors | null => {
    const p = problemasPassword(String(c.value ?? ''), usuario?.());
    return p.length ? { password: p.join('; ') } : null;
  };
