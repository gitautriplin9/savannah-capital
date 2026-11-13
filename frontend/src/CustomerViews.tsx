import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowUpRightFromSquare, Bell, CreditCard, Download, Eye, EyeOff, LockKeyhole, Send, Smartphone, WalletCards } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type Account, type Loan, type SessionUser, type Transaction } from './api';
import { kes } from './config';

const dateLabel = (date: string) => new Date(date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
const timeLabel = (date: string) => new Date(date).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const isCredit = (item: Transaction) => item.entry_direction ? item.entry_direction === 'credit' : ['credit', 'salary', 'loan_disbursement', 'opening'].includes(item.kind);
const toast = (message: string) => window.dispatchEvent(new CustomEvent('app-toast', { detail: message }));

export function AccountsView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => { void api<Account[]>('/accounts').then(setAccounts).catch((cause) => toast(cause.message)); }, []);
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  return <div className="view-stack">
    <section className="balance-hero"><div className="balance-copy"><span className="eyebrow light">TOTAL BALANCE</span><div className="balance-line"><strong>{kes(total)}</strong></div><span className="balance-foot">Across {accounts.length} accounts · Updated today</span></div><div className="balance-watermark">SC</div></section>
    <section className="account-grid">{accounts.map((account) => <article className="account-card" key={account.id}><div className="account-card-head"><span className={`account-icon ${account.type}`}><WalletCards size={18} /></span><span className="account-type">{account.type === 'savings' ? 'GOAL SAVINGS' : account.type === 'mobile' ? 'MOBILE WALLET' : 'TRANSACTIONAL'}</span></div><h3>{account.name}</h3><div className="account-number">•••• •••• {account.number.slice(-4)}</div><strong className="account-balance">{kes(account.balance)}</strong><span className={account.frozen ? 'status-pill warning' : 'status-pill'}>{account.frozen ? 'Frozen' : 'Active'}</span></article>)}</section>
    {!accounts.length && <p className="empty-state">No accounts are available.</p>}
  </div>;
}

export function CustomerOverview() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [masked, setMasked] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { void Promise.all([api<Account[]>('/accounts'), api<Transaction[]>('/transactions')]).then(([a, t]) => { setAccounts(a); setTransactions(t); }).catch((cause) => setError(cause.message)); }, []);
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const chart = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() - (6 - index));
    const rows = transactions.filter((item) => new Date(item.created_at).toDateString() === day.toDateString());
    return { day: day.toLocaleDateString('en-KE', { weekday: 'short' }), income: rows.filter(isCredit).reduce((sum, item) => sum + item.amount, 0), spend: rows.filter((item) => !isCredit(item)).reduce((sum, item) => sum + item.amount, 0) };
  });
  return <div className="view-stack">
    {error && <div className="inline-error">{error}</div>}
    <section className="balance-hero"><div className="balance-copy"><span className="eyebrow light">TOTAL BALANCE</span><div className="balance-line"><strong>{masked ? kes(total) : 'KES ••••••••'}</strong><button className="icon-button light-icon" title={masked ? 'Hide balance' : 'Show balance'} onClick={() => setMasked(!masked)}>{masked ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><span className="balance-foot">Across {accounts.length} accounts <span>·</span> As of today</span></div><div className="hero-actions"><a href="/app/transfers"><Send size={17} /> Transfer</a><a href="/app/statements"><ArrowUpRightFromSquare size={17} /> Statement</a></div><div className="balance-watermark">SC</div></section>
    <section className="account-grid">{accounts.map((account) => <article className="account-card" key={account.id}><div className="account-card-head"><span className={`account-icon ${account.type}`}><WalletCards size={18} /></span><span className="account-type">{account.type === 'savings' ? 'GOAL SAVINGS' : account.type === 'mobile' ? 'MOBILE WALLET' : 'TRANSACTIONAL'}</span><button className="dots-button" aria-label="Account options">···</button></div><h3>{account.name}</h3><div className="account-number">{masked ? `•••• •••• ${account.number.slice(-4)}` : account.number}</div><strong className="account-balance">{kes(account.balance)}</strong><span className={account.frozen ? 'status-pill warning' : 'status-pill'}>{account.frozen ? 'Frozen' : 'Active'}</span></article>)}</section>
    <section className="dashboard-grid"><article className="surface chart-surface"><div className="section-heading"><div><p className="eyebrow">CASH FLOW</p><h2>Income & spending</h2></div><span className="period-label">Last 7 days</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} barGap={5}><CartesianGrid vertical={false} stroke="#e9eee9" /><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value) => kes(Number(value))} /><Bar dataKey="income" fill="#005A32" radius={[4, 4, 0, 0]} /><Bar dataKey="spend" fill="#8CC63F" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="chart-legend"><span><i className="legend-green" /> Income</span><span><i className="legend-lime" /> Spending</span></div></article>
      <article className="surface activity-surface"><div className="section-heading"><div><p className="eyebrow">ACCOUNT ACTIVITY</p><h2>Recent transactions</h2></div><a className="text-link" href="/app/statements">View all <ArrowUpRight size={14} /></a></div><TransactionList items={transactions.slice(0, 5)} /></article></section>
  </div>;
}

export function TransferView({ initialType = 'mobile_money' }: { initialType?: string }) {
  const [type, setType] = useState(initialType);
  const [accountType, setAccountType] = useState('current');
  const [bank, setBank] = useState('Equity');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);
  const [fees, setFees] = useState({ mpesaFeeKes: 25, transferFeeKes: 0 });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Array<{ id: string; name: string; destination: string; accountRef: string }>>([]);
  useEffect(() => { void Promise.all([api<Account[]>('/accounts'), api<typeof beneficiaries>('/beneficiaries'), api<typeof fees>('/config/fees')]).then(([a, b, f]) => { setAccounts(a); setBeneficiaries(b); setFees(f); }).catch((cause) => toast(cause.message)); }, []);
  const fee = ['mobile_money', 'airtel_money'].includes(type) ? fees.mpesaFeeKes : fees.transferFeeKes;
  const account = accounts.find((item) => item.type === accountType);
  const destinationLabel = ['mobile_money', 'airtel_money'].includes(type) ? 'Mobile number' : type === 'internal' || type === 'pesalink' ? 'Account number' : 'Paybill, till or phone number';
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const target = type === 'pesalink' ? `${bank} · ${destination}` : destination;
      const result = await api<{ reference: string; otp: string }>('/transfers', { method: 'POST', body: JSON.stringify({ type, accountType, destination: target, amount: Number(amount), note, idempotencyKey: crypto.randomUUID() }) });
      if (saveBeneficiary) {
        await api('/beneficiaries', { method: 'POST', body: JSON.stringify({ name: note || destination, destination: type, accountRef: target }) });
        setBeneficiaries(await api<typeof beneficiaries>('/beneficiaries'));
      }
      toast(`${result.otp} · Reference ${result.reference}`); setAmount(''); setDestination(''); setNote('');
    } catch (cause) { toast(cause instanceof Error ? cause.message : 'Transfer failed.'); }
    finally { setBusy(false); }
  }
  const chooseBeneficiary = (id: string) => { const match = beneficiaries.find((item) => item.id === id); if (match) setDestination(match.accountRef); };
  return <div className="content-columns"><section className="surface form-surface"><div className="section-heading"><div><p className="eyebrow">MOVE MONEY</p><h2>{initialType === 'bill' ? 'Pay a bill' : 'New payment'}</h2></div><span className="secure-label"><LockKeyhole size={14} /> Secure</span></div>
    <div className="transfer-types">{[['mobile_money', 'Mobile money', <Smartphone size={17} />], ['pesalink', 'PesaLink', <ArrowUpRight size={17} />], ['bill', 'Bills', <WalletCards size={17} />], ['airtime', 'Airtime', <CreditCard size={17} />]] .map(([value, label, icon]) => <button key={String(value)} className={type === value ? 'active' : ''} onClick={() => setType(String(value))}>{icon}{label}</button>)}</div>
    <form className="form-grid" onSubmit={submit}>
      <label>From account<select value={accountType} onChange={(event) => setAccountType(event.target.value)}>{accounts.map((item) => <option key={item.id} value={item.type}>{item.name} · {kes(item.balance)}</option>)}</select></label>
      <label>Payment type<select value={type} onChange={(event) => setType(event.target.value)}><option value="mobile_money">M-Pesa</option><option value="airtel_money">Airtel Money</option><option value="internal">Savannah Capital account</option><option value="pesalink">PesaLink</option><option value="vooma">Vooma / Buy Goods Till</option><option value="bill">KPLC / Water / Zuku / DSTV</option><option value="airtime">Airtime</option></select></label>
      {type === 'pesalink' && <label>Destination bank<select value={bank} onChange={(event) => setBank(event.target.value)}><option>Equity</option><option>Co-op</option><option>NCBA</option><option>Absa</option><option>Stanbic</option></select></label>}
      {beneficiaries.length > 0 && <label>Saved beneficiary<select defaultValue="" onChange={(event) => chooseBeneficiary(event.target.value)}><option value="">Choose a saved beneficiary</option>{beneficiaries.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.destination}</option>)}</select></label>}
      <label>{destinationLabel}<input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={['mobile_money', 'airtel_money'].includes(type) ? '+254 7XX XXX XXX' : type === 'internal' ? 'Savannah Capital account number' : 'Enter destination'} required /></label>
      <label>Amount (KES)<input type="number" min="1" max="2000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required /></label>
      <label className="form-wide">Note <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What is this payment for?" maxLength={120} /></label>
      <label className="save-beneficiary form-wide"><input type="checkbox" checked={saveBeneficiary} onChange={(event) => setSaveBeneficiary(event.target.checked)} /> Save this beneficiary</label>
      <div className="fee-line form-wide"><span>Transfer fee</span><strong>{kes(fee)}</strong></div>
      <div className="fee-line total-line form-wide"><span>Total debit</span><strong>{kes((Number(amount) || 0) + fee)}</strong></div>
      <p className="available-line form-wide">Available balance <strong>{kes(account?.balance ?? 0)}</strong></p>
      <button className="primary-button form-wide" disabled={busy || !amount}>{busy ? 'Processing…' : 'Review and send'}<ArrowUpRight size={17} /></button>
    </form>
  </section><aside className="surface transfer-aside"><p className="eyebrow">QUICK PAY</p><h2>Popular services</h2>{[['KPLC tokens', 'Bill · Electricity'], ['Nairobi Water', 'Bill · Water'], ['Zuku', 'Bill · Internet'], ['DSTV', 'Bill · TV'], ['Buy Goods Till', 'Merchant payment']].map(([name, meta]) => <button key={name} className="service-row" onClick={() => { setType(name === 'Buy Goods Till' ? 'vooma' : 'bill'); setDestination(name === 'KPLC tokens' ? '37123456789' : ''); setNote(name); }}><span className="service-mark"><ArrowUpRight size={16} /></span><span><strong>{name}</strong><small>{meta}</small></span><ArrowUpRight size={15} /></button>)}<p className="aside-note">Payments are simulated. No funds leave your account.</p></aside></div>;
}

export function BillPaymentsView() {
  return <TransferView initialType="bill" />;
}

export function LoansView() {
  const [amount, setAmount] = useState(100_000);
  const [tenure, setTenure] = useState(12);
  const [purpose, setPurpose] = useState('Personal expenses');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<Loan[]>('/loans').then(setLoans).catch((cause) => toast(cause.message)); }, []);
  const monthlyRate = 0.13 / 12;
  const payment = amount * monthlyRate / (1 - (1 + monthlyRate) ** -tenure);
  let balance = amount;
  const schedule = Array.from({ length: tenure }, (_, index) => { const interest = balance * monthlyRate; const principal = payment - interest; balance = Math.max(0, balance - principal); return { month: index + 1, payment, principal, interest, balance }; });
  async function apply() {
    setBusy(true);
    try { const result = await api<{ status: string; otp?: string; replayed?: boolean }>('/loans/apply', { method: 'POST', body: JSON.stringify({ amount, tenureMonths: tenure, purpose, idempotencyKey: crypto.randomUUID() }) }); toast(`${result.status === 'approved' ? 'Loan approved and credited.' : 'Application sent for review.'} ${result.otp ?? ''}`); setLoans(await api<Loan[]>('/loans')); }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'Loan request failed.'); }
    finally { setBusy(false); }
  }
  async function repay(loan: Loan) {
    const outstanding = Math.max(0, loan.amount_cents - loan.repaid_cents) / 100;
    const value = window.prompt(`Repay this loan. Outstanding principal: ${kes(outstanding)}`, String(Math.min(1000, outstanding)));
    if (!value) return;
    try {
      const result = await api<{ reference: string }>('/loans/' + loan.id + '/repay', { method: 'POST', body: JSON.stringify({ amount: Number(value), idempotencyKey: crypto.randomUUID() }) });
      toast(`Repayment posted · ${result.reference}`); setLoans(await api<Loan[]>('/loans'));
    } catch (cause) { toast(cause instanceof Error ? cause.message : 'Repayment failed.'); }
  }
  return <div className="view-stack"><div className="content-columns loan-columns"><section className="surface form-surface"><div className="section-heading"><div><p className="eyebrow">BORROW</p><h2>Personal loan calculator</h2></div><span className="rate-label">13% p.a.</span></div><label className="range-label">Loan amount <strong>{kes(amount)}</strong><input type="range" min="5000" max="2000000" step="5000" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label className="range-label">Repayment period <strong>{tenure} months</strong><input type="range" min="1" max="36" value={tenure} onChange={(event) => setTenure(Number(event.target.value))} /></label><label>Loan purpose<input value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={160} /></label><div className="payment-estimate"><span>Estimated monthly repayment</span><strong>{kes(payment)}</strong><small>Total repayment {kes(payment * tenure)} · Interest {kes(payment * tenure - amount)}</small></div><button className="primary-button" onClick={() => void apply()} disabled={busy}>{busy ? 'Submitting…' : 'Apply for a loan'}<ArrowUpRight size={17} /></button><p className="aside-note">Requests up to KES 50,000 auto-approve in this simulation. Larger requests enter the Loan Officer queue.</p></section>
    <section className="surface schedule-surface"><div className="section-heading"><div><p className="eyebrow">REPAYMENT PLAN</p><h2>Monthly schedule</h2></div></div><div className="table-scroll"><table><thead><tr><th>Month</th><th>Principal</th><th>Interest</th><th>Payment</th><th>Balance</th></tr></thead><tbody>{schedule.map((row) => <tr key={row.month}><td>{String(row.month).padStart(2, '0')}</td><td>{kes(row.principal)}</td><td>{kes(row.interest)}</td><td>{kes(row.payment)}</td><td>{kes(row.balance)}</td></tr>)}</tbody></table></div></section></div>
    <section className="surface"><div className="section-heading"><div><p className="eyebrow">YOUR APPLICATIONS</p><h2>Loan history</h2></div></div>{loans.length ? <div className="table-scroll"><table><thead><tr><th>Purpose</th><th>Amount</th><th>Tenure</th><th>Status</th><th>Action</th></tr></thead><tbody>{loans.map((loan) => <tr key={loan.id}><td>{loan.purpose}</td><td>{kes(loan.amount_cents / 100)}</td><td>{loan.tenure_months} months</td><td><span className={`status-pill ${loan.status === 'pending' ? 'warning' : ''}`}>{loan.status}</span></td><td>{loan.status === 'approved' && loan.repaid_cents < loan.amount_cents ? <button className="table-action" onClick={() => void repay(loan)}>Repay</button> : '—'}</td></tr>)}</tbody></table></div> : <p className="empty-state">No loan applications yet.</p>}</section></div>;
}

export function StatementsView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => { void api<Transaction[]>('/transactions').then(setTransactions).catch((cause) => toast(cause.message)); }, []);
  const filtered = transactions.filter((tx) => {
    const credit = isCredit(tx);
    const date = tx.created_at.slice(0, 10);
    return (kind === 'all' || (kind === 'credit' ? credit : !credit)) && (!from || date >= from) && (!to || date <= to) && `${tx.reference} ${tx.description} ${tx.counterparty}`.toLowerCase().includes(search.toLowerCase());
  });
  const chart = [{ name: 'Income', value: filtered.filter(isCredit).reduce((sum, tx) => sum + tx.amount, 0) }, { name: 'Expense', value: filtered.filter((tx) => !isCredit(tx)).reduce((sum, tx) => sum + tx.amount, 0) }];
  function downloadCsv() {
    const content = ['Date,Reference,Description,Type,Amount (KES),Status', ...filtered.map((tx) => [tx.created_at, tx.reference, `"${tx.description.replaceAll('"', '""')}"`, tx.kind, tx.amount.toFixed(2), tx.status].join(','))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' })); link.download = 'savannah-capital-statement.csv'; link.click(); URL.revokeObjectURL(link.href);
  }
  return <div className="view-stack"><div className="statement-charts"><article className="surface"><div className="section-heading"><div><p className="eyebrow">PERIOD TOTALS</p><h2>Credits & debits</h2></div></div><div className="chart-wrap compact-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid vertical={false} stroke="#e9eee9" /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value) => kes(Number(value))} /><Bar dataKey="value" fill="#005A32" radius={[4, 4, 0, 0]}>{chart.map((entry, index) => <Cell key={entry.name} fill={index ? '#8CC63F' : '#005A32'} />)}</Bar></BarChart></ResponsiveContainer></div></article><article className="surface"><div className="section-heading"><div><p className="eyebrow">SPENDING MIX</p><h2>By direction</h2></div></div><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={4}>{chart.map((item, index) => <Cell key={item.name} fill={index ? '#8CC63F' : '#005A32'} />)}</Pie><Tooltip formatter={(value) => kes(Number(value))} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{filtered.length}</strong><span>transactions</span></div></div></article></div>
    <section className="surface"><div className="section-heading"><div><p className="eyebrow">ACCOUNT HISTORY</p><h2>Mini statement</h2></div><div className="export-actions"><button className="outline-button" onClick={downloadCsv}><Download size={15} /> CSV</button><button className="outline-button" onClick={() => window.print()}><Download size={15} /> PDF</button></div></div><div className="filters"><label>Search<input placeholder="Reference or details" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label>Type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">All activity</option><option value="credit">Credits</option><option value="debit">Debits</option></select></label><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div><TransactionTable items={filtered} /></section></div>;
}

export function CardsView() {
  const [cards, setCards] = useState<Array<{ id: string; lastFour: string; type: string; frozen: boolean }>>([]);
  useEffect(() => { void api<typeof cards>('/cards').then(setCards).catch((cause) => toast(cause.message)); }, []);
  async function toggle(card: typeof cards[number]) {
    try { await api(`/cards/${card.id}/freeze`, { method: 'POST', body: JSON.stringify({ frozen: !card.frozen }) }); setCards(cards.map((item) => item.id === card.id ? { ...item, frozen: !item.frozen } : item)); toast(`Card ${card.frozen ? 'unfrozen' : 'frozen'} in your account.`); }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'Could not update card.'); }
  }
  return <div className="cards-grid">{cards.map((card) => <article className={`bank-card ${card.frozen ? 'card-frozen' : ''}`} key={card.id}><div className="bank-card-top"><strong>SC</strong><CreditCard size={22} /></div><div className="card-chip" /><div className="card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;{card.lastFour}</div><div className="bank-card-bottom"><div><small>CARDHOLDER</small><span>SAVANNAH CAPITAL CLIENT</span></div><div><small>TYPE</small><span>{card.type}</span></div></div><span className="card-status">{card.frozen ? 'FROZEN' : 'ACTIVE'}</span><button className="outline-button" onClick={() => void toggle(card)}>{card.frozen ? 'Unfreeze card' : 'Freeze card'}</button></article>)}<article className="surface card-info"><span className="account-icon"><CreditCard size={18} /></span><h2>Digital card controls</h2><p>Freeze or unfreeze your simulated card instantly. Card activity does not connect to a payment network.</p><div className="info-line"><span>Online transactions</span><strong>Enabled</strong></div><div className="info-line"><span>Contactless</span><strong>Enabled</strong></div></article></div>;
}

export function SettingsView() {
  const [currentPin, setCurrentPin] = useState(''); const [newPin, setNewPin] = useState(''); const [busy, setBusy] = useState(false);
  async function changePin(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const result = await api<{ message: string; otp: string }>('/security/pin', { method: 'POST', body: JSON.stringify({ currentPin, newPin }) }); toast(`${result.message} ${result.otp}`); setCurrentPin(''); setNewPin(''); }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'PIN update failed.'); }
    finally { setBusy(false); }
  }
  return <div className="settings-grid"><section className="surface form-surface"><div className="section-heading"><div><p className="eyebrow">SECURITY</p><h2>Change your PIN</h2></div><span className="account-icon"><LockKeyhole size={18} /></span></div><form className="form-grid" onSubmit={changePin}><label>Current 4-digit PIN<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} required /></label><label>New 4-digit PIN<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={newPin} onChange={(event) => setNewPin(event.target.value)} required /></label><p className="aside-note form-wide">Verification codes are simulated and are not delivered by SMS.</p><button className="primary-button form-wide" disabled={busy}>Update PIN<ArrowUpRight size={17} /></button></form></section></div>;
}

export function ProfileView() {
  const [profile, setProfile] = useState<SessionUser | null>(null);
  useEffect(() => { void api<SessionUser>('/auth/me').then(setProfile).catch((cause) => toast(cause.message)); }, []);
  return <section className="surface profile-surface"><p className="eyebrow">CUSTOMER PROFILE</p><h2>{profile?.name ?? 'Loading profile…'}</h2><div className="info-line"><span>Email</span><strong>{profile?.email ?? ''}</strong></div><div className="info-line"><span>Mobile</span><strong>{profile?.phone ?? ''}</strong></div><div className="info-line"><span>KYC status</span><strong className="text-green">{profile?.kycStatus ?? 'Loading'}</strong></div><div className="info-line"><span>Notifications</span><strong>In-app enabled</strong></div></section>;
}

export function NotificationsView() {
  const [items, setItems] = useState<Array<{ id: string; title: string; body: string; read: number; created_at: string }>>([]);
  async function load() { try { setItems(await api<typeof items>('/notifications')); } catch (cause) { toast(cause instanceof Error ? cause.message : 'Notifications unavailable.'); } }
  useEffect(() => { void load(); }, []);
  async function markRead(id: string) {
    try { await api(`/notifications/${id}/read`, { method: 'POST', body: '{}' }); setItems(items.map((item) => item.id === id ? { ...item, read: 1 } : item)); }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'Could not update notification.'); }
  }
  return <section className="surface"><div className="section-heading"><div><p className="eyebrow">IN-APP UPDATES</p><h2>Notifications</h2></div><span className="period-label">{items.filter((item) => !item.read).length} unread</span></div><div className="notification-list">{items.map((item) => <article className={`notification-row ${item.read ? '' : 'unread'}`} key={item.id}><span className="notification-mark"><BellIcon /></span><span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString('en-KE')}</time></span>{!item.read && <button className="table-action" onClick={() => void markRead(item.id)}>Mark read</button>}</article>)}{!items.length && <p className="empty-state">You are all caught up.</p>}</div></section>;
}
function BellIcon() { return <Bell size={17} />; }

function TransactionList({ items }: { items: Transaction[] }) {
  if (!items.length) return <p className="empty-state">No transactions found.</p>;
  return <div className="transaction-list">{items.map((tx) => { const credit = isCredit(tx); return <div className="transaction-row" key={tx.id}><span className={`transaction-icon ${credit ? 'credit' : ''}`}>{credit ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><span className="transaction-info"><strong>{tx.description}</strong><small>{dateLabel(tx.created_at)} · {tx.reference}</small></span><strong className={credit ? 'amount-credit' : 'amount-debit'}>{credit ? '+' : '−'}{kes(tx.amount)}</strong></div>; })}</div>;
}
function TransactionTable({ items }: { items: Transaction[] }) {
  return <div className="table-scroll"><table><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>{items.map((tx) => { const credit = isCredit(tx); return <tr key={tx.id}><td>{timeLabel(tx.created_at)}</td><td>{tx.description}</td><td className="reference-text">{tx.reference}</td><td>{credit ? 'Credit' : 'Debit'}</td><td className={credit ? 'amount-credit' : 'amount-debit'}>{credit ? '+' : '−'}{kes(tx.amount)}</td><td><span className={`status-pill ${tx.flagged ? 'warning' : ''}`}>{tx.flagged ? 'Flagged' : tx.status}</span></td></tr>; })}</tbody></table>{!items.length && <p className="empty-state">No transactions match these filters.</p>}</div>;
}
