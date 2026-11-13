import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { db } from './db.js';
import { ApiError, audit, creditAccount, transfer } from './ledger.js';
import { auth, staffAuth, validate } from './middleware.js';

export const staffRoutes = express.Router();
staffRoutes.get('/staff/customers', staffAuth, (req, res) => {
  const query = String(req.query.q ?? '').trim();
  res.json(db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.status,u.kyc_status AS kycStatus,
    (SELECT COALESCE(SUM(CASE le.direction WHEN 'credit' THEN le.amount_cents ELSE -le.amount_cents END),0) FROM accounts a JOIN ledger_entries le ON le.account_id=a.id WHERE a.user_id=u.id AND a.type!='clearing') AS balanceCents
    FROM users u WHERE u.role='customer' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?) ORDER BY u.name LIMIT 100`)
    .all(`%${query}%`, `%${query}%`, `%${query}%`));
});
staffRoutes.post('/staff/deposit', auth(['teller']), (req, res, next) => {
  try {
    const input = validate(z.object({ userId: z.string(), amount: z.number().positive().max(500_000), description: z.string().min(3), idempotencyKey: z.string().min(8) }), req.body);
    res.status(201).json(creditAccount(input.userId, input.amount, input.description, 'cash_deposit', req.user!.id, input.idempotencyKey));
  } catch (error) { next(error); }
});
staffRoutes.post('/staff/withdraw', auth(['teller']), (req, res, next) => {
  try {
    const input = validate(z.object({ userId: z.string(), amount: z.number().positive().max(200_000), idempotencyKey: z.string().min(8) }), req.body);
    const result = transfer({ userId: input.userId, amount: input.amount, kind: 'cash_withdrawal', description: 'Teller cash withdrawal', counterparty: 'Savannah Capital Teller', idempotencyKey: input.idempotencyKey });
    audit(req.user!.id, 'teller_withdrawal', { userId: input.userId, amount: input.amount, reference: result.reference });
    res.status(201).json(result);
  } catch (error) { next(error); }
});
staffRoutes.post('/staff/customers/:id/kyc', auth(['teller', 'admin']), (req, res, next) => {
  try {
    const { status } = validate(z.object({ status: z.enum(['approved', 'pending', 'rejected']) }), req.body);
    const result = db.prepare("UPDATE users SET kyc_status=? WHERE id=? AND role='customer'").run(status, req.params.id);
    if (!result.changes) throw new ApiError(404, 'Customer not found.');
    audit(req.user!.id, 'kyc_updated', { customerId: req.params.id, status });
    res.json({ status });
  } catch (error) { next(error); }
});
staffRoutes.post('/loans/:id/review', auth(['loan_officer', 'admin']), (req, res, next) => {
  try {
    const input = validate(z.object({ decision: z.enum(['approved', 'rejected']), comment: z.string().max(240).default('') }), req.body);
    const loan = db.prepare("SELECT * FROM loans WHERE id=? AND status='pending'").get(req.params.id) as { id: string; user_id: string; amount_cents: number } | undefined;
    if (!loan) throw new ApiError(404, 'Pending loan application not found.');
    const timestamp = new Date().toISOString();
    const decide = db.transaction(() => {
      db.prepare('UPDATE loans SET status=?,reviewer_comment=?,decided_at=? WHERE id=?').run(input.decision, input.comment, timestamp, loan.id);
      if (input.decision === 'approved') creditAccount(loan.user_id, loan.amount_cents / 100, 'Approved loan disbursement', 'loan_disbursement', req.user!.id);
      audit(req.user!.id, 'loan_decision', { loanId: loan.id, decision: input.decision, comment: input.comment });
    });
    decide();
    res.json({ status: input.decision });
  } catch (error) { next(error); }
});
