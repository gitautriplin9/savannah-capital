import { useState } from 'react';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Building2, ChevronLeft,
  CreditCard, FileText, Gauge, HandCoins, LockKeyhole, ShieldCheck, Users, WalletCards,
} from 'lucide-react';
import { BRAND, kes } from './config';
import './preview.css';

type View = 'overview' | 'payments' | 'loans' | 'cards' | 'statements' | 'alerts' | 'operations';

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

const transactions = [
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

export default function ReadOnlyPreview({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>('overview');
  const active = navigation.find((item) => item.id === view)!;
  const Icon = active.icon;

  return <main className="preview-page">
    <div className="preview-banner">
      <ShieldCheck size={15} />
      <strong>READ-ONLY PREVIEW</strong>
      <span>Fictional sample data · No real accounts or money movement</span>
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
        <div className="preview-sidebar-note"><LockKeyhole size={15} /><span><strong>Viewing only</strong><small>All financial actions are disabled.</small></span></div>
      </aside>
      <section className="preview-main">
        <header className="preview-topbar">
          <div className="preview-crumb"><Icon size={14} /><span>Savannah Capital</span><i>/</i><strong>{active.label}</strong></div>
          <span className="preview-user"><span>AN</span><span><strong>Alex Njeri</strong><small>Sample customer</small></span></span>
        </header>
        <div className="preview-content">
          <div className="preview-heading">
            <div><p className="eyebrow">{view === 'operations' ? 'STAFF VIEW · SAMPLE DATA' : 'CUSTOMER VIEW · SAMPLE DATA'}</p><h1>{titleByView[view]}</h1></div>
            <span className="preview-readonly"><LockKeyhole size={13} /> Read only</span>
          </div>
          {view === 'overview' && <Overview onNavigate={setView} />}
          {view === 'payments' && <Payments />}
          {view === 'loans' && <Loans />}
          {view === 'cards' && <Cards />}
          {view === 'statements' && <Statements />}
          {view === 'alerts' && <Alerts />}
          {view === 'operations' && <Operations />}
          <p className="preview-footnote"><ShieldCheck size={13} /> Illustration only. These fictional values are not linked to any customer, account, bank, or payment network.</p>
        </div>
      </section>
    </div>
  </main>;
}

function Overview({ onNavigate }: { onNavigate: (view: View) => void }) {
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
        <TransactionRows compact />
      </section>
    </div>
    <section className="preview-notice"><ShieldCheck size={16} /><span><strong>Safe product preview</strong><small>Transfers, loan applications, card controls, and account changes are not connected to financial services.</small></span></section>
  </div>;
}

function Payments() {
  return <div className="preview-stack">
    <section className="preview-notice"><LockKeyhole size={16} /><span><strong>Payment actions are unavailable in this preview</strong><small>Browse fictional payment history below. No transfer or payment can be initiated.</small></span></section>
    <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">HISTORY</p><h2>Payments & transfers</h2></div><span>Sample records</span></div><TransactionRows /></section>
    <div className="preview-account-grid preview-summary-grid">
      <article className="preview-card"><small>SIMULATED TRANSFERS</small><strong>12</strong><span className="preview-muted">Illustrative monthly count</span></article>
      <article className="preview-card"><small>PAYMENT CHANNELS</small><strong>3</strong><span className="preview-muted">Bank · wallet · biller</span></article>
      <article className="preview-card"><small>AVAILABLE ACTIONS</small><strong>None</strong><span className="preview-muted">Read-only experience</span></article>
    </div>
  </div>;
}

function Loans() {
  return <div className="preview-stack">
    <section className="preview-notice"><LockKeyhole size={16} /><span><strong>Lending products are for display only</strong><small>Applications, approvals, disbursements, and repayments are not available.</small></span></section>
    <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">SAMPLE FACILITY</p><h2>Personal growth loan</h2></div><span className="preview-status">Illustrative</span></div>
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

function Cards() {
  return <div className="preview-stack">
    <section className="preview-notice"><LockKeyhole size={16} /><span><strong>Card controls are disabled</strong><small>This sample card is fictional. It cannot be used, locked, or managed.</small></span></section>
    <div className="preview-card-grid">
      <article className="preview-visual-card"><div><strong>SAVANNAH</strong><CreditCard size={22} /></div><span className="preview-chip" /><p>•••• &nbsp; •••• &nbsp; •••• &nbsp; 4821</p><div><small>SAMPLE CARDHOLDER</small><span>ALEX NJERI</span></div><small>NOT VALID FOR PAYMENT</small></article>
      <section className="preview-card"><p className="eyebrow">CARD DETAILS</p><h2>Everyday debit card</h2><div className="preview-detail"><span>Card status</span><strong>Sample active</strong></div><div className="preview-detail"><span>Card type</span><strong>Debit · Fictional</strong></div><div className="preview-detail"><span>Recent purchases</span><strong>4 sample entries</strong></div><button className="preview-disabled" type="button" disabled><LockKeyhole size={14} /> Card controls disabled</button></section>
    </div>
  </div>;
}

function Statements() {
  return <section className="preview-card"><div className="preview-section-title"><div><p className="eyebrow">ACCOUNT RECORDS</p><h2>Sample statement</h2></div><span>November 2026</span></div><p className="preview-muted">Fictional entries for interface preview only.</p><div className="preview-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.reference}><td>{transaction.date}</td><td>{transaction.description}</td><td>{transaction.reference}</td><td className={transaction.direction === 'in' ? 'preview-positive' : ''}>{transaction.amount > 0 ? '+' : ''}{kes(transaction.amount)}</td></tr>)}</tbody></table></div><button className="preview-disabled" type="button" disabled><LockKeyhole size={14} /> Statement export disabled</button></section>;
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
    <button className="preview-disabled" type="button" disabled><LockKeyhole size={14} /> Staff actions disabled</button>
  </div>;
}

function TransactionRows({ compact = false }: { compact?: boolean }) {
  const rows = compact ? transactions.slice(0, 4) : transactions;
  return <div className="preview-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{rows.map((transaction) => <tr key={transaction.reference}><td>{transaction.date}</td><td><span className="preview-transaction-name">{transaction.direction === 'in' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{transaction.description}</span></td><td>{transaction.reference}</td><td className={transaction.direction === 'in' ? 'preview-positive' : ''}>{transaction.amount > 0 ? '+' : ''}{kes(transaction.amount)}</td></tr>)}</tbody></table></div>;
}
