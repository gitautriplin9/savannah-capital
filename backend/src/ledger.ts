import crypto from 'node:crypto';
import { db } from './db.js';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'request_error') {
    super(message);
  }
}

export const reference = () => `SAV${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
export const cents = (kes: number) => Math.round(kes * 100);

export function accountBalance(accountId: string): number {
  const row = db.prepare(`SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END),0) AS balance
    FROM ledger_entries WHERE account_id = ?`).get(accountId) as { balance: number };
  return row.balance;
}

export function accountForUser(userId: string, type = 'current') {
  return db.prepare('SELECT * FROM accounts WHERE user_id = ? AND type = ?').get(userId, type) as
    | { id: string; user_id: string; type: string; name: string; number: string; frozen: number }
    | undefined;
}

export function clearingAccountId(): string {
  const row = db.prepare("SELECT id FROM accounts WHERE type='clearing' LIMIT 1").get() as { id: string } | undefined;
  if (!row) throw new ApiError(500, 'Clearing account is not initialized.');
  return row.id;
}

export function audit(actorId: string | null, action: string, details: unknown) {
  db.prepare('INSERT INTO audit_logs (id,actor_id,action,details,created_at) VALUES (?,?,?,?,?)')
    .run(crypto.randomUUID(), actorId, action, JSON.stringify(details), new Date().toISOString());
}

export function transfer(input: {
  userId: string; accountType?: string; amount: number; fee?: number; kind: string;
  description: string; counterparty: string; idempotencyKey: string; destinationAccountId?: string;
}) {
  const amountCents = cents(input.amount);
  const feeCents = cents(input.fee ?? 0);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new ApiError(400, 'Amount must be greater than zero.', 'invalid_amount');
  const account = accountForUser(input.userId, input.accountType ?? 'current');
  if (!account) throw new ApiError(404, 'Account not found.', 'account_not_found');
  if (account.frozen) throw new ApiError(403, 'This account is frozen.', 'account_frozen');
  const destination = input.destinationAccountId
    ? db.prepare("SELECT id,frozen FROM accounts WHERE id=? AND type!='clearing'").get(input.destinationAccountId) as { id: string; frozen: number } | undefined
    : undefined;
  if (input.destinationAccountId && !destination) throw new ApiError(404, 'Destination account not found.', 'destination_not_found');
  if (destination?.id === account.id) throw new ApiError(400, 'Choose a different destination account.', 'same_account');
  if (destination?.frozen) throw new ApiError(403, 'The destination account is frozen.', 'destination_frozen');
  const existing = db.prepare('SELECT reference FROM transactions WHERE idempotency_key = ?').get(input.idempotencyKey) as { reference: string } | undefined;
  if (existing) return { reference: existing.reference, replayed: true };
  if (accountBalance(account.id) < amountCents + feeCents) throw new ApiError(400, 'Insufficient funds. Overdrafts are not allowed.', 'insufficient_funds');

  const txId = crypto.randomUUID();
  const ref = reference();
  const timestamp = new Date().toISOString();
  const execute = db.transaction(() => {
    const burst = db.prepare(`SELECT COUNT(*) AS count FROM transactions WHERE user_id = ? AND kind IN ('transfer','mobile_money','airtel_money') AND created_at >= ?`)
      .get(input.userId, new Date(Date.now() - 5 * 60_000).toISOString()) as { count: number };
    const flagged = amountCents >= 10_000_000 || burst.count >= 3 ? 1 : 0;
    db.prepare(`INSERT INTO transactions (id,reference,user_id,kind,description,amount_cents,fee_cents,status,counterparty,idempotency_key,flagged,created_at)
      VALUES (?,?,?,?,?,?,?,'completed',?,?,?,?)`).run(
      txId, ref, input.userId, input.kind, input.description, amountCents, feeCents,
      input.counterparty, input.idempotencyKey, flagged, timestamp,
    );
    const entries = db.prepare('INSERT INTO ledger_entries (id,transaction_id,account_id,direction,amount_cents,created_at) VALUES (?,?,?,?,?,?)');
    entries.run(crypto.randomUUID(), txId, account.id, 'debit', amountCents, timestamp);
    if (feeCents > 0) entries.run(crypto.randomUUID(), txId, account.id, 'debit', feeCents, timestamp);
    if (destination) {
      entries.run(crypto.randomUUID(), txId, destination.id, 'credit', amountCents, timestamp);
      if (feeCents > 0) entries.run(crypto.randomUUID(), txId, clearingAccountId(), 'credit', feeCents, timestamp);
    } else entries.run(crypto.randomUUID(), txId, clearingAccountId(), 'credit', amountCents + feeCents, timestamp);
    db.prepare('INSERT INTO audit_logs (id,actor_id,action,details,created_at) VALUES (?,?,?,?,?)')
      .run(crypto.randomUUID(), input.userId, 'transfer', JSON.stringify({ reference: ref, amountCents, feeCents }), timestamp);
    return { reference: ref, replayed: false, flagged: Boolean(flagged) };
  });
  return execute();
}

export function creditAccount(userId: string, amount: number, description: string, kind: string, actorId: string, idempotencyKey?: string) {
  const account = accountForUser(userId);
  if (!account) throw new ApiError(404, 'Account not found.');
  if (account.frozen) throw new ApiError(403, 'This account is frozen.');
  if (idempotencyKey) {
    const existing = db.prepare('SELECT reference FROM transactions WHERE idempotency_key=?').get(idempotencyKey) as { reference: string } | undefined;
    if (existing) return { reference: existing.reference, replayed: true };
  }
  const amountCents = cents(amount);
  const transactionId = crypto.randomUUID();
  const ref = reference();
  const timestamp = new Date().toISOString();
  const execute = db.transaction(() => {
    db.prepare(`INSERT INTO transactions (id,reference,user_id,kind,description,amount_cents,status,counterparty,idempotency_key,created_at)
      VALUES (?,?,?,?,?,?,'completed',?,?,?)`).run(transactionId, ref, userId, kind, description, amountCents, 'Savannah Capital Teller', idempotencyKey ?? null, timestamp);
    db.prepare('INSERT INTO ledger_entries (id,transaction_id,account_id,direction,amount_cents,created_at) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), transactionId, account.id, 'credit', amountCents, timestamp);
    db.prepare('INSERT INTO ledger_entries (id,transaction_id,account_id,direction,amount_cents,created_at) VALUES (?,?,?,?,?,?)')
      .run(crypto.randomUUID(), transactionId, clearingAccountId(), 'debit', amountCents, timestamp);
    db.prepare('INSERT INTO audit_logs (id,actor_id,action,details,created_at) VALUES (?,?,?,?,?)')
      .run(crypto.randomUUID(), actorId, kind, JSON.stringify({ userId, amountCents, reference: ref }), timestamp);
  });
  execute();
  return { reference: ref, replayed: false };
}
