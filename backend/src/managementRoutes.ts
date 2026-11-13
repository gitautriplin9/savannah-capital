import express from 'express';
import { z } from 'zod';
import { db, resetSeededData } from './db.js';
import { ApiError, audit, cents } from './ledger.js';
import { managementAuth, validate } from './middleware.js';

export const managementRoutes = express.Router();
managementRoutes.get('/management/overview', managementAuth, (_req, res) => {
  const deposits = db.prepare("SELECT COALESCE(SUM(CASE le.direction WHEN 'credit' THEN le.amount_cents ELSE -le.amount_cents END),0) AS total FROM accounts a JOIN ledger_entries le ON le.account_id=a.id JOIN users u ON u.id=a.user_id WHERE u.role='customer' AND a.type!='clearing'").get() as { total: number };
  const customers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='customer' AND status='active'").get() as { count: number };
  const daily = db.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(amount_cents),0) AS total FROM transactions WHERE created_at>=?').get(new Date(new Date().setHours(0, 0, 0, 0)).toISOString()) as { count: number; total: number };
  const loanMix = db.prepare('SELECT status,COUNT(*) AS count,COALESCE(SUM(amount_cents),0) AS amountCents FROM loans GROUP BY status').all();
  res.json({ totalDeposits: deposits.total / 100, activeCustomers: customers.count, dailyTransactionCount: daily.count, dailyTransactionVolume: daily.total / 100, loanMix });
});
managementRoutes.get('/management/transactions', managementAuth, (_req, res) => res.json(db.prepare('SELECT t.*,u.name AS customer_name FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 100').all()));
managementRoutes.get('/management/customers', managementAuth, (_req, res) => res.json(db.prepare("SELECT id,name,email,phone,status,kyc_status AS kycStatus FROM users WHERE role='customer' ORDER BY name").all()));
managementRoutes.post('/management/customers/:id/freeze', managementAuth, (req, res, next) => {
  try {
    const { frozen } = validate(z.object({ frozen: z.boolean() }), req.body);
    const update = db.transaction(() => {
      const user = db.prepare("UPDATE users SET status=? WHERE id=? AND role='customer'").run(frozen ? 'frozen' : 'active', req.params.id);
      if (!user.changes) throw new ApiError(404, 'Customer not found.');
      db.prepare('UPDATE accounts SET frozen=? WHERE user_id=?').run(Number(frozen), req.params.id);
      audit(req.user!.id, frozen ? 'customer_frozen' : 'customer_unfrozen', { customerId: req.params.id });
    });
    update();
    res.json({ frozen });
  } catch (error) { next(error); }
});
managementRoutes.get('/management/audit', managementAuth, (_req, res) => res.json(db.prepare('SELECT a.*,u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200').all()));
managementRoutes.get('/management/settings', managementAuth, (_req, res) => res.json(Object.fromEntries((db.prepare('SELECT key,value FROM settings').all() as Array<{ key: string; value: string }>).map(({ key, value }) => [key, Number(value)]))));
managementRoutes.put('/management/settings', managementAuth, (req, res, next) => {
  try {
    const input = validate(z.object({ dailyLimitKes: z.number().positive().max(2_000_000), mpesaFeeKes: z.number().min(0).max(500), transferFeeKes: z.number().min(0).max(500) }), req.body);
    const save = db.transaction(() => {
      const update = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      update.run('daily_limit_cents', String(cents(input.dailyLimitKes)));
      update.run('mpesa_fee_cents', String(cents(input.mpesaFeeKes)));
      update.run('transfer_fee_cents', String(cents(input.transferFeeKes)));
      audit(req.user!.id, 'settings_changed', input);
    });
    save();
    res.json({ saved: true });
  } catch (error) { next(error); }
});
managementRoutes.post('/management/reset', managementAuth, (_req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') throw new ApiError(403, 'Seeded-data reset is disabled in production.', 'operation_disabled');
    resetSeededData();
    audit('u-admin', 'seeded_data_reset', {});
    res.json({ reset: true });
  }
  catch (error) { next(error); }
});
