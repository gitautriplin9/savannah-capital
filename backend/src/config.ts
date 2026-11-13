export { BRAND } from '../../brand.js';

export const PORT = Number(process.env.PORT ?? 5000);
export const HOST = process.env.HOST ?? '0.0.0.0';
export const ACCESS_SECRET = process.env.ACCESS_SECRET ?? 'demo-access-secret-change-me';
export const REFRESH_SECRET = process.env.REFRESH_SECRET ?? 'demo-refresh-secret-change-me';
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173,http://0.0.0.0:5173').split(',').map((value) => value.trim()).filter(Boolean);
