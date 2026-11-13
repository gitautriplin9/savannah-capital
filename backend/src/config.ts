export { BRAND } from '../../brand.js';

export const PORT = Number(process.env.PORT ?? 5000);
export const HOST = process.env.HOST ?? '0.0.0.0';
function secret(name: string, localValue: string) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} must be configured in production.`);
  return localValue;
}

export const ACCESS_SECRET = secret('ACCESS_SECRET', 'local-access-secret-change-before-deployment');
export const REFRESH_SECRET = secret('REFRESH_SECRET', 'local-refresh-secret-change-before-deployment');
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173,http://0.0.0.0:5173').split(',').map((value) => value.trim()).filter(Boolean);
