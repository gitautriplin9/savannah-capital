import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(process.env.DATABASE_FILE ?? path.join(dataDir, 'demo.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  pin_hash TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer','teller','loan_officer','admin')),
  status TEXT NOT NULL DEFAULT 'active', kyc_status TEXT NOT NULL DEFAULT 'approved',
  failed_logins INTEGER NOT NULL DEFAULT 0, locked_until TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL,
  name TEXT NOT NULL, number TEXT NOT NULL UNIQUE, frozen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL, description TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'completed',
  counterparty TEXT NOT NULL DEFAULT '', idempotency_key TEXT UNIQUE,
  flagged INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id),
  account_id TEXT NOT NULL REFERENCES accounts(id), direction TEXT NOT NULL CHECK(direction IN ('credit','debit')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), amount_cents INTEGER NOT NULL,
  tenure_months INTEGER NOT NULL, rate_percent REAL NOT NULL DEFAULT 13,
  purpose TEXT NOT NULL, status TEXT NOT NULL, reviewer_comment TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  repaid_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, decided_at TEXT
);
CREATE TABLE IF NOT EXISTS beneficiaries (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
  destination TEXT NOT NULL, account_ref TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), last_four TEXT NOT NULL,
  type TEXT NOT NULL, frozen INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  body TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL,
  details TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);
`;
db.exec(schema);
const loanColumns = db.prepare('PRAGMA table_info(loans)').all() as Array<{ name: string }>;
if (!loanColumns.some((column) => column.name === 'repaid_cents')) db.exec('ALTER TABLE loans ADD COLUMN repaid_cents INTEGER NOT NULL DEFAULT 0');
if (!loanColumns.some((column) => column.name === 'idempotency_key')) db.exec('ALTER TABLE loans ADD COLUMN idempotency_key TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_idempotency ON loans(idempotency_key)');

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function insertAccount(userId: string, type: string, name: string, accountNumber: string) {
  const id = uuid();
  db.prepare('INSERT INTO accounts (id,user_id,type,name,number,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, userId, type, name, accountNumber, now());
  return id;
}

function insertSeedTransaction(userId: string, accountId: string, cents: number, kind: string, description: string, date: Date, direction: 'credit' | 'debit', counterparty = 'KCB Demo') {
  const txId = uuid();
  const reference = `KCB${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const createdAt = date.toISOString();
  db.prepare(`INSERT INTO transactions (id,reference,user_id,kind,description,amount_cents,status,counterparty,created_at,flagged)
    VALUES (?,?,?,?,?,?,'completed',?,?,?)`).run(txId, reference, userId, kind, description, cents, counterparty, createdAt, cents > 10_000_000 ? 1 : 0);
  db.prepare('INSERT INTO ledger_entries (id,transaction_id,account_id,direction,amount_cents,created_at) VALUES (?,?,?,?,?,?)')
    .run(uuid(), txId, accountId, direction, cents, createdAt);
  const clearingId = (db.prepare("SELECT id FROM accounts WHERE type='clearing' LIMIT 1").get() as { id: string }).id;
  db.prepare('INSERT INTO ledger_entries (id,transaction_id,account_id,direction,amount_cents,created_at) VALUES (?,?,?,?,?,?)')
    .run(uuid(), txId, clearingId, direction === 'credit' ? 'debit' : 'credit', cents, createdAt);
}

export function seedDemo() {
  const count = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
  if (count > 0) return;

  const addUser = (id: string, email: string, password: string, name: string, phone: string, role: string, pin = '1234') => {
    db.prepare(`INSERT INTO users (id,email,password_hash,pin_hash,name,phone,role,status,kyc_status,created_at)
      VALUES (?,?,?,?,?,?,?,'active','approved',?)`).run(id, email, bcrypt.hashSync(password, 10), bcrypt.hashSync(pin, 10), name, phone, role, now());
  };

  addUser('u-salim', 'salim.demo@kcbbank.co.ke', 'Password123!', 'Salim Kiplimo', '+254 712 345 678', 'customer');
  addUser('u-admin', 'admin@kcbbank.co.ke', 'Admin123!', 'Management Reviewer', '+254 700 000 001', 'admin');
  addUser('u-teller', 'teller@kcbbank.co.ke', 'Teller123!', 'Jane Wanjiku', '+254 700 000 002', 'teller');
  addUser('u-loan', 'loans@kcbbank.co.ke', 'Loan123!', 'Peter Mutua', '+254 700 000 003', 'loan_officer');
  addUser('u-amina', 'amina.demo@kcbbank.co.ke', 'Customer123!', 'Amina Otieno', '+254 722 111 222', 'customer');
  addUser('u-brian', 'brian.demo@kcbbank.co.ke', 'Customer123!', 'Brian Mwangi', '+254 733 222 333', 'customer');
  addUser('u-grace', 'grace.demo@kcbbank.co.ke', 'Customer123!', 'Grace Njeri', '+254 711 333 444', 'customer');
  addUser('u-david', 'david.demo@kcbbank.co.ke', 'Customer123!', 'David Kiptoo', '+254 722 444 555', 'customer');
  insertAccount('u-admin', 'clearing', 'Demo Clearing Ledger', 'CLEARING-0001');

  const accountIds = new Map<string, { current: string; savings: string; mobile: string }>();
  const customerData = [
    { id: 'u-salim', current: 60_531_500, savings: 125_000_000, mobile: 35_000 },
    { id: 'u-amina', current: 28_450_000, savings: 74_000_000, mobile: 18_500 },
    { id: 'u-brian', current: 16_200_000, savings: 42_500_000, mobile: 22_000 },
    { id: 'u-grace', current: 36_800_000, savings: 90_000_000, mobile: 12_500 },
    { id: 'u-david', current: 22_300_000, savings: 51_000_000, mobile: 9_000 },
  ];

  customerData.forEach((customer, index) => {
    const suffix = String(index + 1).padStart(3, '0');
    const current = insertAccount(customer.id, 'current', 'Current Account', `12345678${suffix}`);
    const savings = insertAccount(customer.id, 'savings', 'KCB Goal Savings', `98765432${suffix}`);
    const mobile = insertAccount(customer.id, 'mobile', 'M-Pesa Virtual Account', `25470000${suffix}`);
    db.prepare('INSERT INTO cards (id,user_id,last_four,type,created_at) VALUES (?,?,?,?,?)')
      .run(uuid(), customer.id, String(4821 + index), 'Visa debit', now());
    accountIds.set(customer.id, { current, savings, mobile });
    insertSeedTransaction(customer.id, current, customer.current, 'opening', 'Opening balance', new Date(Date.now() - 31 * 86400000), 'credit');
    insertSeedTransaction(customer.id, savings, customer.savings, 'opening', 'Opening balance', new Date(Date.now() - 31 * 86400000), 'credit');
    insertSeedTransaction(customer.id, mobile, customer.mobile, 'opening', 'Opening balance', new Date(Date.now() - 31 * 86400000), 'credit');
  });

  const salim = accountIds.get('u-salim')!;
  const records = [
    [20, 4852000, 'Salary', 'Salary deposit - Acme Kenya Ltd', 'credit'],
    [19, 185000, 'Bill payment', 'KPLC tokens - 37123456789', 'debit'],
    [18, 320000, 'Transfer', 'M-Pesa transfer to 0712 000 111', 'debit'],
    [17, 127500, 'Card payment', 'Naivas Supermarket - Kilimani', 'debit'],
    [16, 750000, 'Transfer', 'PesaLink - Amina Otieno', 'debit'],
    [15, 83000, 'Bill payment', 'Nairobi Water - 0098123', 'debit'],
    [14, 255000, 'Credit', 'Consulting payment', 'credit'],
    [13, 42000, 'Airtime', 'Safaricom airtime', 'debit'],
    [12, 150000, 'Transfer', 'M-Pesa transfer to 0722 123 456', 'debit'],
    [11, 630000, 'Card payment', 'Carrefour - Junction Mall', 'debit'],
    [10, 5000000, 'Transfer', 'PesaLink - Business settlement', 'debit'],
    [9, 405000, 'Credit', 'Freelance project payment', 'credit'],
    [8, 118000, 'Bill payment', 'Zuku monthly subscription', 'debit'],
    [7, 250000, 'Transfer', 'Transfer from M-Pesa', 'credit'],
    [6, 215000, 'Card payment', 'Quickmart - Lavington', 'debit'],
    [5, 12000000, 'Transfer', 'Property deposit - verified', 'debit'],
    [4, 570000, 'Credit', 'Insurance reimbursement', 'credit'],
    [3, 28000, 'Airtime', 'Airtel airtime', 'debit'],
    [2, 195000, 'Bill payment', 'DSTV subscription', 'debit'],
    [1, 1500000, 'Salary', 'Salary deposit - Acme Kenya Ltd', 'credit'],
  ] as const;

  records.forEach(([daysAgo, amount, kind, description, direction], index) => {
    const date = new Date(Date.now() - daysAgo * 86400000 + index * 1900000);
    insertSeedTransaction('u-salim', salim.current, amount, kind, description, date, direction, description.includes('Salary') ? 'Acme Kenya Ltd' : 'Demo beneficiary');
  });

  const otherIds = ['u-amina', 'u-brian', 'u-grace', 'u-david'];
  otherIds.forEach((userId, index) => {
    const account = accountIds.get(userId)!.current;
    for (let item = 0; item < 4; item += 1) {
      const credit = item === 0 || item === 3;
      insertSeedTransaction(userId, account, (item + 2 + index) * 12500, credit ? 'Credit' : 'Card payment', credit ? 'Monthly income' : 'Retail purchase', new Date(Date.now() - (item + index + 2) * 86400000), credit ? 'credit' : 'debit');
    }
  });

  db.prepare(`INSERT INTO loans (id,user_id,amount_cents,tenure_months,rate_percent,purpose,status,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run('loan-pending-1', 'u-amina', 85_000_000, 18, 13, 'School fees and home improvement', 'pending', now());
  db.prepare('INSERT INTO beneficiaries (id,user_id,name,destination,account_ref,created_at) VALUES (?,?,?,?,?,?)')
    .run(uuid(), 'u-salim', 'Amina Otieno', 'PesaLink', '1234567890', now());
  db.prepare('INSERT INTO notifications (id,user_id,title,body,created_at) VALUES (?,?,?,?,?)')
    .run(uuid(), 'u-salim', 'Welcome to KCB Digital', 'Your demo accounts are ready to explore.', now());
  db.prepare("INSERT INTO settings (key,value) VALUES ('daily_limit_cents','50000000'),('mpesa_fee_cents','2500'),('transfer_fee_cents','0')").run();
}

export function resetDemo() {
  const reset = db.transaction(() => {
    db.exec('DELETE FROM ledger_entries; DELETE FROM transactions; DELETE FROM loans; DELETE FROM beneficiaries; DELETE FROM cards; DELETE FROM notifications; DELETE FROM audit_logs; DELETE FROM accounts; DELETE FROM users; DELETE FROM settings;');
    seedDemo();
  });
  reset();
}

seedDemo();
