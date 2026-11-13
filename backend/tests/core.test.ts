import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';

process.env.NODE_ENV = 'test';
process.env.DATABASE_FILE = ':memory:';
process.env.CORS_ORIGINS = 'https://savannah-capital-uuly.vercel.app';

const { db, resetSeededData } = await import('../src/db.js');
const { accountBalance, accountForUser, transfer } = await import('../src/ledger.js');
const { app } = await import('../src/index.js');
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(app);
  server.keepAliveTimeout = 60_000;
  server.headersTimeout = 65_000;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
});
beforeEach(() => resetSeededData());

async function login(role: 'customer' | 'admin' | 'teller' | 'loan_officer') {
  const credentials = {
    customer: { identifier: 'salim@savannahcapital.example', password: 'Password123!' },
    admin: { identifier: 'admin@savannahcapital.example', password: 'Admin123!' },
    teller: { identifier: 'teller@savannahcapital.example', password: 'Teller123!' },
    loan_officer: { identifier: 'loans@savannahcapital.example', password: 'Loan123!' },
  }[role];
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) });
  if (!response.ok) throw new Error(`Seeded ${role} sign-in failed (${response.status}).`);
  return response.json() as Promise<{ accessToken: string }>;
}

describe('banking invariants', () => {
  it('allows the production frontend origin but rejects unrelated browser origins', async () => {
    const allowed = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: 'https://savannah-capital-uuly.vercel.app' },
    });
    const denied = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: 'https://untrusted.example' },
    });

    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://savannah-capital-uuly.vercel.app');
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

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
    transfer({ userId: 'u-salim', amount: 100, kind: 'transfer', description: 'Balanced', counterparty: 'Saved beneficiary', idempotencyKey: 'balance-test-key-1' });
    const unbalanced = db.prepare(`SELECT transaction_id FROM ledger_entries GROUP BY transaction_id
      HAVING SUM(CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END) != 0`).all();
    expect(unbalanced).toHaveLength(0);
  });

  it('credits the recipient for an internal transfer', () => {
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
      const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: 'salim@savannahcapital.example', password: 'wrong-password' }) });
      expect(response.status).toBe(attempt === 4 ? 423 : 401);
    }
  });

  it('enforces management RBAC on protected endpoints', async () => {
    const { accessToken } = await login('customer');
    const response = await fetch(`${baseUrl}/api/management/overview`, { headers: { authorization: `Bearer ${accessToken}` } });
    expect(response.status).toBe(403);
  });

  it('only allows users to sign in to their assigned team workspace', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: 'teller@savannahcapital.example',
        password: 'Teller123!',
        expectedRole: 'admin',
      }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: 'workspace_forbidden' },
    });
  });

  it('allows staff to sign in to their assigned team workspace', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        identifier: 'loans@savannahcapital.example',
        password: 'Loan123!',
        expectedRole: 'loan_officer',
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.user.role).toBe('loan_officer');
    expect(payload.accessToken).toBeTruthy();
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
      body: JSON.stringify({ identifier: 'salim@savannahcapital.example', password: 'ResetPass123!' }),
    });
    expect(byEmail.status).toBe(200);

    const loginAfterEmailReset = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: 'salim@savannahcapital.example', password: 'ResetPass123!' }),
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
      body: JSON.stringify({ identifier: 'salim@savannahcapital.example', password: 'PhoneReset456!' }),
    });
    expect(loginAfterPhoneReset.status).toBe(200);
  }, 15_000);

  it('supports seeded sign-in, a transfer, a loan application, and an admin freeze', async () => {
    const customer = await login('customer');
    const admin = await login('admin');
    const headers = { authorization: `Bearer ${customer.accessToken}`, 'content-type': 'application/json' };
    const transferResponse = await fetch(`${baseUrl}/api/transfers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'mobile_money', destination: '+254700000111', amount: 100, note: 'Integration test', idempotencyKey: 'seed-transfer-test-01' }),
    });
    expect(transferResponse.status).toBe(201);
    expect((await transferResponse.json()).reference).toMatch(/^SAV/);

    const loanResponse = await fetch(`${baseUrl}/api/loans/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: 1000, tenureMonths: 6, purpose: 'Integration test', idempotencyKey: 'seed-loan-test-01' }),
    });
    expect(loanResponse.status).toBe(201);
    expect((await loanResponse.json()).status).toBe('approved');

    const freezeResponse = await fetch(`${baseUrl}/api/management/customers/u-salim/freeze`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ frozen: true }),
    });
    expect(freezeResponse.status).toBe(200);
    expect((await freezeResponse.json()).frozen).toBe(true);

    const frozenAccessResponse = await fetch(`${baseUrl}/api/accounts`, { headers: { authorization: `Bearer ${customer.accessToken}` } });
    expect(frozenAccessResponse.status).toBe(403);
  });
});
