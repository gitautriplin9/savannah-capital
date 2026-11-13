import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from './db.js';
import { ApiError, accountBalance, accountForUser, audit, cents, creditAccount, transfer } from './ledger.js';
import { auth, customerAuth, validate } from './middleware.js';

export const customerRoutes = express.Router();
customerRoutes.get('/config/fees', (_req, res) => {
  const settings = Object.fromEntries((db.prepare('SELECT key,value FROM settings').all() as Array<{ key: string; value: string }>).map(({ key, value }) => [key, Number(value)]));
  res.json({ dailyLimitKes: (settings.daily_limit_cents ?? 50_000_000) / 100, mpesaFeeKes: (settings.mpesa_fee_cents ?? 2500) / 100, transferFeeKes: (settings.transfer_fee_cents ?? 0) / 100 });
});
const otp = (email: string) => {
  const code = String(crypto.randomInt(100000, 999999));
  console.info(`[DEMO OTP] ${email}: ${code}`);
  return `Demo verification code: ${code}`;
};

customerRoutes.get('/accounts', customerAuth, (req, res) => {
  const accounts = db.prepare("SELECT * FROM accounts WHERE user_id=? AND type!='clearing' ORDER BY CASE type WHEN 'current' THEN 1 WHEN 'savings' THEN 2 ELSE 3 END").all(req.user!.id) as Array<{ id: string; type: string; name: string; number: string; frozen: number }>;
  res.json(accounts.map((account) => ({ ...account, balance: accountBalance(account.id) / 100, frozen: Boolean(account.frozen) })));
});

customerRoutes.get('/transactions', customerAuth, (req, res) => {
  const rows = db.prepare(`SELECT t.*,a.name AS account_name,le.direction AS entry_direction FROM transactions t JOIN ledger_entries le ON le.transaction_id=t.id
    JOIN accounts a ON a.id=le.account_id WHERE a.user_id=? AND a.type!='clearing' ORDER BY t.created_at DESC LIMIT 200`)
    .all(req.user!.id) as Array<Record<string, unknown>>;
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  res.json(unique.map((row) => ({ ...row, amount: Number(row.amount_cents) / 100, fee: Number(row.fee_cents ?? 0) / 100, flagged: Boolean(row.flagged) })));
});

customerRoutes.post('/transfers', customerAuth, (req, res, next) => {
  try {
    const input = validate(z.object({
      type: z.enum(['mobile_money', 'airtel_money', 'internal', 'pesalink', 'vooma', 'bill', 'airtime']),
      accountType: z.enum(['current', 'savings', 'mobile']).default('current'),
      destination: z.string().min(3).max(120), amount: z.number().positive().max(2_000_000),
      note: z.string().max(120).default(''), idempotencyKey: z.string().min(8).max(100),
    }), req.body);
    const feeSettings = db.prepare("SELECT key,value FROM settings WHERE key IN ('mpesa_fee_cents','transfer_fee_cents')").all() as Array<{ key: string; value: string }>;
    const fees = Object.fromEntries(feeSettings.map(({ key, value }) => [key, Number(value)]));
    const fee = (input.type === 'mobile_money' || input.type === 'airtel_money' ? fees.mpesa_fee_cents ?? 2500 : fees.transfer_fee_cents ?? 0) / 100;
    const limitCents = Number((db.prepare("SELECT value FROM settings WHERE key='daily_limit_cents'").get() as { value: string } | undefined)?.value ?? 5_000_000);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const daily = db.prepare("SELECT COALESCE(SUM(amount_cents+fee_cents),0) AS total FROM transactions WHERE user_id=? AND kind IN ('mobile_money','airtel_money','transfer','vooma','bill','airtime') AND created_at>=?")
      .get(req.user!.id, startOfDay.toISOString()) as { total: number };
    const alreadySent = db.prepare('SELECT reference FROM transactions WHERE idempotency_key=?').get(input.idempotencyKey);
    if (!alreadySent && daily.total + cents(input.amount) + cents(fee) > limitCents) throw new ApiError(400, 'This transaction exceeds your daily transfer limit.', 'daily_limit_exceeded');
    let destinationAccountId: string | undefined;
    let counterparty = input.destination;
    if (input.type === 'internal') {
      const destinationAccount = db.prepare("SELECT id,user_id,number,frozen FROM accounts WHERE number=? AND type!='clearing'").get(input.destination) as { id: string; user_id: string; number: string; frozen: number } | undefined;
      if (!destinationAccount) throw new ApiError(404, 'KCB demo account not found.', 'destination_not_found');
      if (destinationAccount.frozen) throw new ApiError(403, 'The destination account is frozen.', 'destination_frozen');
      const holder = db.prepare('SELECT name FROM users WHERE id=?').get(destinationAccount.user_id) as { name: string };
      destinationAccountId = destinationAccount.id;
      counterparty = `${holder.name} · ${destinationAccount.number}`;
    }
    const result = transfer({
      userId: req.user!.id, accountType: input.accountType, amount: input.amount, fee,
      kind: input.type === 'pesalink' || input.type === 'internal' ? 'transfer' : input.type,
      description: input.note || `${input.type.replace('_', ' ')} to ${input.destination}`,
      counterparty, idempotencyKey: input.idempotencyKey, destinationAccountId,
    });
    res.status(201).json({ ...result, fee, otp: otp(req.user!.email) });
  } catch (error) { next(error); }
});

customerRoutes.get('/beneficiaries', customerAuth, (req, res) => res.json(db.prepare('SELECT id,name,destination,account_ref AS accountRef FROM beneficiaries WHERE user_id=? ORDER BY name').all(req.user!.id)));
customerRoutes.post('/beneficiaries', customerAuth, (req, res, next) => {
  try {
    const input = validate(z.object({ name: z.string().min(2), destination: z.string().min(2), accountRef: z.string().min(3) }), req.body);
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO beneficiaries (id,user_id,name,destination,account_ref,created_at) VALUES (?,?,?,?,?,?)')
      .run(id, req.user!.id, input.name, input.destination, input.accountRef, new Date().toISOString());
    audit(req.user!.id, 'beneficiary_added', { id, destination: input.destination });
    res.status(201).json({ id, ...input });
  } catch (error) { next(error); }
});

customerRoutes.get('/loans', auth(), (req, res) => {
  const rows = req.user!.role === 'customer'
    ? db.prepare('SELECT * FROM loans WHERE user_id=? ORDER BY created_at DESC').all(req.user!.id)
    : db.prepare('SELECT l.*,u.name AS customer_name,u.email AS customer_email FROM loans l JOIN users u ON u.id=l.user_id ORDER BY l.created_at DESC').all();
  res.json(rows);
});
customerRoutes.post('/loans/apply', customerAuth, (req, res, next) => {
  try {
    const input = validate(z.object({ amount: z.number().positive().max(2_000_000), tenureMonths: z.number().int().min(1).max(36), purpose: z.string().min(3).max(160), idempotencyKey: z.string().min(8).max(100) }), req.body);
    const prior = db.prepare('SELECT id,status FROM loans WHERE idempotency_key=?').get(input.idempotencyKey) as { id: string; status: string } | undefined;
    if (prior) return res.json({ id: prior.id, status: prior.status, replayed: true });
    const id = crypto.randomUUID();
    const approved = input.amount <= 50_000;
    const timestamp = new Date().toISOString();
    const apply = db.transaction(() => {
      db.prepare('INSERT INTO loans (id,user_id,amount_cents,tenure_months,rate_percent,purpose,status,created_at,idempotency_key) VALUES (?,?,?,?,13,?,?,?,?)')
        .run(id, req.user!.id, cents(input.amount), input.tenureMonths, input.purpose, approved ? 'approved' : 'pending', timestamp, input.idempotencyKey);
      audit(req.user!.id, 'loan_application', { loanId: id, amount: input.amount, status: approved ? 'approved' : 'pending' });
      if (approved) creditAccount(req.user!.id, input.amount, 'Instant Mobile Loan disbursement', 'loan_disbursement', req.user!.id, `loan-disbursement:${input.idempotencyKey}`);
    });
    apply();
    res.status(201).json({ id, status: approved ? 'approved' : 'pending', otp: otp(req.user!.email) });
  } catch (error) { next(error); }
});
customerRoutes.post('/loans/:id/repay', customerAuth, (req, res, next) => {
  try {
    const input = validate(z.object({ amount: z.number().positive(), idempotencyKey: z.string().min(8) }), req.body);
    const loan = db.prepare("SELECT * FROM loans WHERE id=? AND user_id=? AND status='approved'").get(req.params.id, req.user!.id) as { id: string; amount_cents: number; repaid_cents: number } | undefined;
    if (!loan) throw new ApiError(404, 'Active loan not found.');
    const amountCents = cents(input.amount);
    if (amountCents + loan.repaid_cents > loan.amount_cents) throw new ApiError(400, 'Repayment exceeds the outstanding principal.');
    const repay = db.transaction(() => {
      const result = transfer({ userId: req.user!.id, amount: input.amount, kind: 'loan_repayment', description: 'Loan repayment', counterparty: `Loan ${loan.id.slice(0, 8)}`, idempotencyKey: input.idempotencyKey });
      if (!result.replayed) {
        db.prepare('UPDATE loans SET repaid_cents=repaid_cents+? WHERE id=?').run(amountCents, loan.id);
        audit(req.user!.id, 'loan_repayment', { loanId: loan.id, amountCents });
      }
      return result;
    });
    res.json(repay());
  } catch (error) { next(error); }
});

customerRoutes.get('/cards', customerAuth, (req, res) => res.json(db.prepare('SELECT id,last_four AS lastFour,type,frozen FROM cards WHERE user_id=?').all(req.user!.id)));
customerRoutes.post('/cards/:id/freeze', customerAuth, (req, res, next) => {
  try {
    const { frozen } = validate(z.object({ frozen: z.boolean() }), req.body);
    const result = db.prepare('UPDATE cards SET frozen=? WHERE id=? AND user_id=?').run(Number(frozen), req.params.id, req.user!.id);
    if (!result.changes) throw new ApiError(404, 'Card not found.');
    audit(req.user!.id, frozen ? 'card_frozen' : 'card_unfrozen', { cardId: req.params.id });
    res.json({ frozen });
  } catch (error) { next(error); }
});
customerRoutes.get('/notifications', customerAuth, (req, res) => res.json(db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC').all(req.user!.id)));
customerRoutes.post('/notifications/:id/read', customerAuth, (req, res, next) => {
  try {
    const result = db.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user!.id);
    if (!result.changes) throw new ApiError(404, 'Notification not found.');
    res.json({ read: true });
  } catch (error) { next(error); }
});
customerRoutes.post('/security/pin', customerAuth, (req, res, next) => {
  try {
    const input = validate(z.object({ currentPin: z.string().regex(/^\d{4}$/), newPin: z.string().regex(/^\d{4}$/) }), req.body);
    if (!bcrypt.compareSync(input.currentPin, req.user!.pin_hash)) throw new ApiError(400, 'Current PIN is incorrect.');
    db.prepare('UPDATE users SET pin_hash=? WHERE id=?').run(bcrypt.hashSync(input.newPin, 10), req.user!.id);
    audit(req.user!.id, 'pin_changed', {});
    res.json({ message: 'PIN updated.', otp: otp(req.user!.email) });
  } catch (error) { next(error); }
});
