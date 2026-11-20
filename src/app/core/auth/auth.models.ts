export type Rol = 'ADMIN' | 'CONTADOR' | 'CAJERO';
export type Tema = 'light' | 'dark' | 'system';

export interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
  colegioId: number | null;
  colegio?: string | null;
  debeCambiarPassword: boolean;
  tema: Tema;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  usuario: Usuario;
}

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  CONTADOR: 'Contador',
  CAJERO: 'Cajero',
};
