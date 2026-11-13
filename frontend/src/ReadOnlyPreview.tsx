import { useState, type FormEvent } from 'react';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Building2, ChevronLeft,
  CreditCard, FileText, Gauge, HandCoins, LockKeyhole, ShieldCheck, Users, WalletCards,
} from 'lucide-react';
import { BRAND, kes } from './config';
import './preview.css';

type View = 'overview' | 'payments' | 'loans' | 'cards' | 'statements' | 'alerts' | 'operations';
type PreviewTransaction = { date: string; description: string; reference: string; amount: number; direction: 'in' | 'out' };

const navigation: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'payments', label: 'Payments & transfers', icon: ArrowLeftRight },
  { id: 'loans', label: 'Lending', icon: HandCoins },
  { id: 'cards', label: 'Cards', icon: CreditCard },
  { id: 'statements', label: 'Statements', icon: FileText },
  { id: 'alerts', label: 'Notifications', icon: Bell },
  { id: 'operations', label: 'Operations view', icon: Building2 },
];

const accounts = [
  { name: 'Premier Current', type: 'CURRENT ACCOUNT', number: '•••• 4821', balance: 1245800 },
  { name: 'Wealth Builder', type: 'SAVINGS ACCOUNT', number: '•••• 7614', balance: 2320000 },
  { name: 'Everyday Wallet', type: 'MOBILE WALLET', number: '•••• 1907', balance: 84900 },
];

const transactions: PreviewTransaction[] = [
  { date: '13 Nov 2026', description: 'Monthly salary', reference: 'SAV-10483', amount: 285000, direction: 'in' },
  { date: '12 Nov 2026', description: 'Utilities payment', reference: 'SAV-10479', amount: -12450, direction: 'out' },
  { date: '10 Nov 2026', description: 'Transfer to savings', reference: 'SAV-10461', amount: -50000, direction: 'out' },
  { date: '08 Nov 2026', description: 'Merchant purchase', reference: 'SAV-10437', amount: -8320, direction: 'out' },
  { date: '05 Nov 2026', description: 'Investment distribution', reference: 'SAV-10405', amount: 42600, direction: 'in' },
];

const titleByView: Record<View, string> = {
  overview: 'Your financial overview',
  payments: 'Payments & transfers',
  loans: 'Lending',
  cards: 'Cards',
  statements: 'Statements',
  alerts: 'Notifications',
  operations: 'Operations overview',
};

export default function ReadOnlyPreview({ onClose, cardholderName = '' }: { onClose: () => void; cardholderName?: string }) {
  const [view, setView] = useState<View>('overview');
  const [activity, setActivity] = useState(transactions);
  const [cardLocked, setCardLocked] = useState(false);
  const active = navigation.find((item) => item.id === view)!;
  const Icon = active.icon;
  const simulatePayment = (type: string, destination: string, amount: number) => {
    const reference = `DEMO-${Date.now().toString(36).toUpperCase()}`;
    setActivity((current) => [{
      date: new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }),
      description: `${type} · ${destination}`,
      reference,
      amount: -amount,
      direction: 'out',
    }, ...current]);
    return reference;
  };

  return <main className="preview-page">
    <div className="preview-banner">
      <ShieldCheck size={15} />
      <strong>INTERACTIVE DEMO</strong>
      <span>Fictional sample data · Try the flows; no real money moves</span>
      <button type="button" onClick={onClose}><ChevronLeft size={15} /> Back to account access</button>
    </div>
    <div className="preview-shell">
      <aside className="preview-sidebar">
        <div className="preview-brand"><span className="brand-mark">{BRAND.logoText}</span><span><strong>{BRAND.name}</strong><small>Private wealth</small></span></div>
        <p className="preview-nav-label">SAVANNAH CAPITAL</p>
        <nav aria-label="Read-only preview sections">
          {navigation.map(({ id, label, icon: ItemIcon }) => <button key={id} type="button" className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            <ItemIcon size={16} /><span>{label}</span>
          </button>)}
        </nav>
        <div className="preview-sidebar-note"><LockKeyhole size={15} /><span><strong>Simulation only</strong><small>Actions update this demo, not a real account.</small></span></div>
      </aside>
      <section className="preview-main">
        <header className="preview-topbar">
          <div className="preview-crumb"><Icon size={14} /><span>Savannah Capital</span><i>/</i><strong>{active.label}</strong></div>
          <span className="preview-user"><span>SC</span><span><strong>{cardholderName.trim() || 'Cardholder'}</strong><small>{cardholderName.trim() ? 'Name from your account' : 'Interactive demo'}</small></span></span>
        </header>
        <div className="preview-content">
          <div className="preview-heading">
            <div><p className="eyebrow">{view === 'operations' ? 'STAFF VIEW · SAMPLE DATA' : 'CUSTOMER VIEW · SAMPLE DATA'}</p><h1>{titleByView[view]}</h1></div>
            <span className="preview-readonly"><LockKeyhole size={13} /> Simulation</span>
          </div>
          {view === 'overview' && <Overview onNavigate={setView} transactions={activity} />}
          {view === 'payments' && <Payments transactions={activity} onSimulatePayment={simulatePayment} />}
          {view === 'loans' && <Loans />}
          {view === 'cards' && <Cards cardholderName={cardholderName} locked={cardLocked} onToggleLock={() => setCardLocked((current) => !current)} />}
          {view === 'statements' && <Statements transactions={activity} />}
          {view === 'alerts' && <Alerts />}
          {view === 'operations' && <Operations />}
          <p className="preview-footnote"><ShieldCheck size={13} /> Demo actions stay in this browser. No real account, bank, payment network, or customer data is connected.</p>
        </div>
      </section>
    </div>
  </main>;
}

function Overview({ onNavigate, transactions }: { onNavigate: (view: View) => void; transactions: PreviewTransaction[] }) {
  return <div className="preview-stack">
    <section className="preview-balance">
      <div><span>TOTAL SAMPLE BALANCE</span><strong>{kes(accounts.reduce((sum, account) => sum + account.balance, 0))}</strong><small>Across 3 fictional accounts</small></div>
      <WalletCards size={42} />
    </section>
    <div className="preview-account-grid">{accounts.map((account) => <article className="preview-card" key={account.number}>
      <span className="preview-card-icon"><WalletCards size={17} /></span><small>{account.type}</small><h3>{account.name}</h3><span className="preview-muted">{account.number}</span><strong>{kes(account.balance)}</strong>
    </article>)}</div>
    <div className="preview-columns">
      <section className="preview-card">
        <div className="preview-section-title"><div><p className="eyebrow">CASH FLOW</p><h2>Activity snapshot</h2></div><span>Sample month</span></div>
        <div className="preview-bars" aria-label="Illustrative monthly income and spending chart">
          {[['W1', 42, 27], ['W2', 66, 42], ['W3', 49, 32], ['W4', 84, 55]].map(([label, income, spending]) => <div className="preview-bar-group" key={label}>
            <div><i style={{ height: `${income}%` }} /><i style={{ height: `${spending}%` }} /></div><small>{label}</small>
          </div>)}
        </div>
        <div className="preview-legend"><span><i /> Income</span><span><i /> Spending</span></div>
      </section>
      <section className="preview-card">
        <div className="preview-section-title"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest transactions</h2></div><button className="preview-link" type="button" onClick={() => onNavigate('statements')}>View statement <ArrowUpRight size={14} /></button></div>
        <TransactionRows compact transactions={transactions} />
      </section>
    </div>
    <section className="preview-notice"><ShieldCheck size={16} /><span><strong>Explore a complete banking journey</strong><small>Try a sample transfer, export a statement, estimate a loan payment, or preview a card control. Everything remains a local simulation.</small></span></section>
  </div>;
}

function Payments({ transactions, onSimulatePayment }: { transactions: PreviewTransaction[]; onSimulatePayment: (type: string, destination: string, amount: number) => string }) {
  const [type, setType] = useState('Mobile transfer');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const destinationLabel = type === 'Bank transfer' ? 'Bank account number' : type === 'Bill payment' ? 'Biller or account reference' : type === 'Airtime' ? 'Mobile number' : 'Recipient mobile number';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reference = onSimulatePayment(type, destination.trim(), Number(amount));
    setMessage(`Demo payment prepared · ${reference}. No funds were sent.`);
    setDestination('');
    setAmount('');
  }

  return <div className="preview-stack">
    <section className="preview-notice"><LockKeyhole size={16} /><span><strong>Try a simulated payment</strong><small>Choose a recipient type and enter any sample details. This will only add a demo entry; no funds move.</small></span></section>
    <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">PAYMENT DEMO</p><h2>Send to bank or mobile</h2></div><span>Simulation only</span></div>
      <form className="preview-payment-form" onSubmit={submit}>
        <label>Payment type<select value={type} onChange={(event) => setType(event.target.value)}><option>Mobile transfer</option><option>Bank transfer</option><option>Bill payment</option><option>Airtime</option></select></label>
        <label>{destinationLabel}<input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={type === 'Bank transfer' ? 'e.g. 0123456789' : type === 'Bill payment' ? 'e.g. electricity account' : '+254 7XX XXX XXX'} required /></label>
        <label>Amount (KES)<input type="number" min="1" max="2000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label>
        <button className="preview-primary-button" type="submit"><ArrowUpRight size={15} /> Simulate payment</button>
      </form>
      {message && <p className="preview-action-message" role="status">{message}</p>}
    </section>
    <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">HISTORY</p><h2>Payments & transfers</h2></div><span>{transactions.length} sample entries</span></div><TransactionRows transactions={transactions} /></section>
    <div className="preview-account-grid preview-summary-grid">
      <article className="preview-card"><small>SIMULATED TRANSFERS</small><strong>12</strong><span className="preview-muted">Illustrative monthly count</span></article>
      <article className="preview-card"><small>PAYMENT CHANNELS</small><strong>3</strong><span className="preview-muted">Bank · wallet · biller</span></article>
      <article className="preview-card"><small>AVAILABLE ACTIONS</small><strong>Demo only</strong><span className="preview-muted">No real money movement</span></article>
    </div>
  </div>;
}

function Loans() {
  const [amount, setAmount] = useState(250000);
  const [months, setMonths] = useState(12);
  const rate = 0.13 / 12;
  const installment = amount * rate / (1 - (1 + rate) ** -months);
  return <div className="preview-stack">
    <section className="preview-notice"><LockKeyhole size={16} /><span><strong>Estimate a sample loan</strong><small>Adjust the amount and term to explore an illustrative repayment. This does not submit an application or make a lending decision.</small></span></section>
    <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">SAMPLE FACILITY</p><h2>Personal growth loan</h2></div><span className="preview-status">Illustrative</span></div>
      <div className="preview-loan-controls">
        <label>Sample loan amount <strong>{kes(amount)}</strong><input type="range" min="10000" max="1000000" step="10000" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <label>Repayment term <strong>{months} months</strong><input type="range" min="3" max="36" step="1" value={months} onChange={(event) => setMonths(Number(event.target.value))} /></label>
        <div className="preview-loan-estimate"><small>ILLUSTRATIVE MONTHLY PAYMENT · 13% P.A.</small><strong>{kes(installment)}</strong></div>
      </div>
      <div className="preview-loan-summary"><div><small>ORIGINAL AMOUNT</small><strong>{kes(250000)}</strong></div><div><small>OUTSTANDING</small><strong>{kes(168500)}</strong></div><div><small>INDICATIVE RATE</small><strong>13% p.a.</strong></div><div><small>STATUS</small><strong>In progress</strong></div></div>
      <h3 className="preview-subtitle">Example repayment schedule</h3>
      <div className="preview-table-wrap"><table><thead><tr><th>Period</th><th>Due date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        <tr><td>01</td><td>01 Dec 2026</td><td>{kes(22400)}</td><td><span className="preview-status">Upcoming</span></td></tr>
        <tr><td>02</td><td>01 Jan 2027</td><td>{kes(22400)}</td><td><span className="preview-status">Upcoming</span></td></tr>
        <tr><td>03</td><td>01 Feb 2027</td><td>{kes(22400)}</td><td><span className="preview-status">Upcoming</span></td></tr>
      </tbody></table></div>
    </section>
  </div>;
}

function Cards({ cardholderName, locked, onToggleLock }: { cardholderName: string; locked: boolean; onToggleLock: () => void }) {
  return <div className="preview-stack">
    <section className="preview-notice"><LockKeyhole size={16} /><span><strong>Preview a card control</strong><small>This fictional card is not connected to a payment network. The control below changes only this demo.</small></span></section>
    <div className="preview-card-grid">
      <article className="preview-visual-card"><div><strong>SAVANNAH</strong><CreditCard size={22} /></div><span className="preview-chip" /><p>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4821</p><div><small>CARDHOLDER</small><span>{cardholderName.trim() || 'CARDHOLDER'}</span></div><small>DEMO CARD · NOT VALID FOR PAYMENT</small></article>
      <section className="preview-card"><p className="eyebrow">CARD DETAILS</p><h2>Everyday debit card</h2><div className="preview-detail"><span>Card status</span><strong>{locked ? 'Locked in this demo' : 'Active sample'}</strong></div><div className="preview-detail"><span>Card type</span><strong>Debit · Fictional</strong></div><div className="preview-detail"><span>Recent purchases</span><strong>4 sample entries</strong></div><button className="preview-primary-button" type="button" onClick={onToggleLock}><LockKeyhole size={14} /> {locked ? 'Unlock sample card' : 'Lock sample card'}</button><p className="preview-muted">Demo control only; no real card is affected.</p></section>
    </div>
  </div>;
}

function Statements({ transactions }: { transactions: PreviewTransaction[] }) {
  function exportStatement() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ['Date', 'Description', 'Reference', 'Amount (KES)', 'Type'],
      ...transactions.map((transaction) => [transaction.date, transaction.description, transaction.reference, transaction.amount.toFixed(2), transaction.direction === 'in' ? 'Credit' : 'Debit']),
    ];
    const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'savannah-capital-demo-statement.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">ACCOUNT RECORDS</p><h2>Sample statement</h2></div><span>Demo activity</span></div><p className="preview-muted">Fictional entries for interface preview only.</p><div className="preview-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.reference}><td>{transaction.date}</td><td>{transaction.description}</td><td>{transaction.reference}</td><td className={transaction.direction === 'in' ? 'preview-positive' : ''}>{transaction.amount > 0 ? '+' : ''}{kes(transaction.amount)}</td></tr>)}</tbody></table></div><button className="preview-primary-button" type="button" onClick={exportStatement}><FileText size={14} /> Download demo statement (CSV)</button></section>;
}

function Alerts() {
  return <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">SAMPLE MESSAGES</p><h2>Notifications</h2></div><span>3 examples</span></div>
    {[
      ['Account overview ready', 'Your fictional accounts are ready to explore.', 'Today · 09:15'],
      ['Statement available', 'A sample statement has been added to the preview.', 'Yesterday · 16:40'],
      ['Security reminder', 'Keep your sign-in details private and use a strong password.', '10 Nov · 11:20'],
    ].map(([title, message, date]) => <div className="preview-alert" key={title}><span><Bell size={16} /></span><div><strong>{title}</strong><p>{message}</p><small>{date}</small></div></div>)}
  </section>;
}

function Operations() {
  return <div className="preview-stack">
    <section className="preview-notice"><ShieldCheck size={16} /><span><strong>Staff dashboard preview</strong><small>Sample operational metrics only. Customer records and staff actions are not connected.</small></span></section>
    <div className="preview-account-grid preview-summary-grid">
      <article className="preview-card"><small>SAMPLE CUSTOMERS</small><strong>1,248</strong><span className="preview-muted">Illustrative count</span></article>
      <article className="preview-card"><small>ACTIVITY TODAY</small><strong>86</strong><span className="preview-muted">Fictional transactions</span></article>
      <article className="preview-card"><small>REVIEW QUEUE</small><strong>7</strong><span className="preview-muted">Example pending items</span></article>
    </div>
    <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">ACTIVITY MONITOR</p><h2>Recent operational events</h2></div><span className="preview-status">Sample feed</span></div>
      {[
        ['Customer profile reviewed', 'Staff workspace · Sample event', '09:42'],
        ['Loan application received', 'Lending queue · Sample event', '09:18'],
        ['Statement generated', 'Customer services · Sample event', '08:56'],
      ].map(([title, detail, time]) => <div className="preview-alert" key={title}><span><Users size={16} /></span><div><strong>{title}</strong><p>{detail}</p><small>{time}</small></div></div>)}
    </section>
    <p className="preview-muted">Staff actions require an authenticated employee workspace.</p>
  </div>;
}

function TransactionRows({ compact = false, transactions }: { compact?: boolean; transactions: PreviewTransaction[] }) {
  const rows = compact ? transactions.slice(0, 4) : transactions;
  return <div className="preview-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{rows.map((transaction) => <tr key={transaction.reference}><td>{transaction.date}</td><td><span className="preview-transaction-name">{transaction.direction === 'in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{transaction.description}</span></td><td>{transaction.reference}</td><td className={transaction.direction === 'in' ? 'preview-positive' : ''}>{transaction.amount > 0 ? '+' : ''}{kes(transaction.amount)}</td></tr>)}</tbody></table></div>;
}
