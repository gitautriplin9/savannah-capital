import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { HOST, PORT } from './config.js';
import { ApiError } from './ledger.js';
import { authRoutes } from './authRoutes.js';
import { customerRoutes } from './customerRoutes.js';
import { staffRoutes } from './staffRoutes.js';
import { managementRoutes } from './managementRoutes.js';

export const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (_origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', mode: 'simulated-demo' }));
app.get('/api/docs/openapi.json', (_req, res) => res.json({
  openapi: '3.0.3', info: { title: 'KCB Digital Banking Demo API', version: '1.0.0' },
  servers: [{ url: 'http://127.0.0.1:5000' }], paths: {
    '/api/auth/login': { post: { responses: { '200': { description: 'Session created' } } } },
    '/api/auth/demo-login': { post: { responses: { '200': { description: 'Demo session created' } } } },
    '/api/accounts': { get: { responses: { '200': { description: 'Customer accounts' } } } },
    '/api/transfers': { post: { responses: { '201': { description: 'Transfer posted' } } } },
    '/api/loans/apply': { post: { responses: { '201': { description: 'Loan application created' } } } },
    '/api/management/overview': { get: { responses: { '200': { description: 'Management KPIs' } } } },
  },
}));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: '/api/docs/openapi.json' }));
app.use('/api/auth', authRoutes);
app.use('/api', customerRoutes);
app.use('/api', staffRoutes);
app.use('/api', managementRoutes);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  console.error(error);
  return res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } });
});

if (process.env.NODE_ENV !== 'test') app.listen(PORT, HOST, () => console.log(`KCB demo API listening on http://${HOST}:${PORT}`));
