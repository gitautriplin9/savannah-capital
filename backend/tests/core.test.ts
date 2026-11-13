import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';

process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = ':memory:';

const { db, resetDemo } = await import('../src/db.js');
const { accountBalance, accountForUser, transfer } = await import('../src/ledger.js');
const { app } = await import('../src/index.js');
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
});
beforeEach(() => resetDemo());

async function login(role: string) {
  const response = await fetch(`${baseUrl}/api/auth/demo-login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) });
  return response.json() as Promise<{ accessToken: string }>;
}

describe('demo banking invariants', () => {
  it('rejects overdrafts without changing the ledger', () => {
    const account = accountForUser('u-salim')!;
    const before = accountBalance(account.id);
    expect(() => transfer({ userId: 'u-salim', amount: 9_999_999, kind: 'transfer', description: 'Test', counterparty: 'Test', idempotencyKey: 'overdraft-key-001' })).toThrow(/Insufficient funds/);
    expect(accountBalance(account.id)).toBe(before);
    expect((db.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count).toBe(51);
  });

  it('is idempotent and keeps both ledger sides balanced', () => {
    const input = { userId: 'u-salim', amount: 500, fee: 25, kind: 'mobile_money', description: 'Test transfer', counterparty: '+254 700 000 111', idempotencyKey: 'idempotency-key-001' };
    const first = transfer(input);
    const second = transfer(input);
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ reference: first.reference, replayed: true });
    const count = (db.prepare("SELECT COUNT(*) AS count FROM transactions WHERE idempotency_key='idempotency-key-001'").get() as { count: number }).count;
    expect(count).toBe(1);
    const total = db.prepare(`SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END),0) AS balance FROM ledger_entries WHERE transaction_id=(SELECT id FROM transactions WHERE idempotency_key=?)`).get(input.idempotencyKey) as { balance: number };
    expect(total.balance).toBe(0);
  });

  it('rolls back the transaction and ledger when a later audit write fails', () => {
    const account = accountForUser('u-salim')!;
    const beforeBalance = accountBalance(account.id);
    const beforeCount = (db.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count;
    db.exec(`CREATE TRIGGER force_transfer_audit_failure BEFORE INSERT ON audit_logs
      WHEN NEW.action='transfer' BEGIN SELECT RAISE(ABORT,'forced rollback'); END`);
    try {
      expect(() => transfer({ userId: 'u-salim', amount: 500, kind: 'transfer', description: 'Rollback check', counterparty: 'Test', idempotencyKey: 'atomic-rollback-key-1' })).toThrow(/forced rollback/);
    } finally { db.exec('DROP TRIGGER force_transfer_audit_failure'); }
    expect(accountBalance(account.id)).toBe(beforeBalance);
    expect((db.prepare('SELECT COUNT(*) AS count FROM transactions').get() as { count: number }).count).toBe(beforeCount);
  });

  it('keeps every seeded and posted transaction double-entry balanced', () => {
    transfer({ userId: 'u-salim', amount: 100, kind: 'transfer', description: 'Balanced', counterparty: 'Demo', idempotencyKey: 'balance-test-key-1' });
    const unbalanced = db.prepare(`SELECT transaction_id FROM ledger_entries GROUP BY transaction_id
      HAVING SUM(CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END) != 0`).all();
    expect(unbalanced).toHaveLength(0);
  });

  it('credits the recipient for an internal KCB transfer', () => {
    const sender = accountForUser('u-salim')!;
    const recipient = accountForUser('u-amina')!;
    const senderBefore = accountBalance(sender.id);
    const recipientBefore = accountBalance(recipient.id);
    transfer({ userId: 'u-salim', amount: 1250, kind: 'transfer', description: 'Internal transfer', counterparty: 'Amina', idempotencyKey: 'internal-transfer-key-1', destinationAccountId: recipient.id });
    expect(accountBalance(sender.id)).toBe(senderBefore - 125_000);
    expect(accountBalance(recipient.id)).toBe(recipientBefore + 125_000);
  });

  it('locks an account after five failed password attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'salim.demo@kcbbank.co.ke', password: 'wrong-password' }) });
      expect(response.status).toBe(attempt === 4 ? 423 : 401);
    }
  });

  it('enforces management RBAC on protected endpoints', async () => {
    const { accessToken } = await login('customer');
    const response = await fetch(`${baseUrl}/api/management/overview`, { headers: { authorization: `Bearer ${accessToken}` } });
    expect(response.status).toBe(403);
  });

  it('creates a customer account for a new user and logs them in', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Client',
        email: 'new.client@example.com',
        phone: '+254 700 123 456',
        password: 'StrongPass123!',
      }),
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.user.email).toBe('new.client@example.com');
    expect(payload.user.role).toBe('customer');
    expect(payload.accessToken).toBeTruthy();
    expect(payload.refreshToken).toBeTruthy();
    expect((db.prepare('SELECT COUNT(*) AS count FROM users WHERE email=?').get('new.client@example.com') as { count: number }).count).toBe(1);
  });

  it('allows users to reset their password using either their email or phone number', async () => {
    const byEmail = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'salim.demo@kcbbank.co.ke', password: 'ResetPass123!' }),
    });
    expect(byEmail.status).toBe(200);

    const loginAfterEmailReset = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'salim.demo@kcbbank.co.ke', password: 'ResetPass123!' }),
    });
    expect(loginAfterEmailReset.status).toBe(200);

    const byPhone = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: '+254 712 345 678', password: 'PhoneReset456!' }),
    });
    expect(byPhone.status).toBe(200);

    const loginAfterPhoneReset = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'salim.demo@kcbbank.co.ke', password: 'PhoneReset456!' }),
    });
    expect(loginAfterPhoneReset.status).toBe(200);
  });
});
