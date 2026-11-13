import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpRight, CircleDollarSign, RotateCcw, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from './api';
import { BRAND, kes } from './config';
const notify = (message: string) => window.dispatchEvent(new CustomEvent('demo-toast', { detail: message }));
type Overview = { totalDeposits: number; activeCustomers: number; dailyTransactionCount: number; dailyTransactionVolume: number; loanMix: Array<{ status: string; count: number; amountCents: number }> };
type AuditTransaction = { id: string; reference: string; customer_name: string; kind: string; description: string; amount_cents: number; flagged: number; created_at: string; status: string };
type Customer = { id: string; name: string; email: string; phone: string; status: string; kycStatus: string };

export function ManagementOverview() {
  const [overview, setOverview] = useState<Overview | null>(null); const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
  useEffect(() => { void Promise.all([api<Overview>('/management/overview'), api<AuditTransaction[]>('/management/transactions')]).then(([o, t]) => { setOverview(o); setTransactions(t); }).catch((cause) => notify(cause.message)); }, []);
  const daily = transactions.slice(0, 7).reverse().map((tx) => ({ day: new Date(tx.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }), amount: tx.amount_cents / 100 }));
  const colors: Record<string, string> = { approved: BRAND.colors.green, pending: BRAND.colors.lime, rejected: '#d55845' };
  return <div className="view-stack"><div className="kpi-grid">{[
    { label: 'Customer deposits', value: kes(overview?.totalDeposits ?? 0), icon: <CircleDollarSign size={19} />, hint: 'Across active accounts' },
    { label: 'Active customers', value: (overview?.activeCustomers ?? 0).toLocaleString(), icon: <Users size={19} />, hint: 'KYC customer base' },
    { label: 'Transactions today', value: String(overview?.dailyTransactionCount ?? 0), icon: <Activity size={19} />, hint: kes(overview?.dailyTransactionVolume ?? 0) + ' volume' },
    { label: 'Flagged for review', value: String(transactions.filter((tx) => tx.flagged).length), icon: <AlertTriangle size={19} />, hint: 'High value or rapid repeats' },
  ].map((item) => <article className="surface kpi-card" key={item.label}><span className="kpi-icon">{item.icon}</span><small>{item.label}</small><strong>{item.value}</strong><span>{item.hint}</span></article>)}</div>
    <div className="dashboard-grid"><article className="surface chart-surface"><div className="section-heading"><div><p className="eyebrow">TRANSACTION ACTIVITY</p><h2>Recent volume</h2></div><span className="period-label">Latest 7 transactions</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}><defs><linearGradient id="volume" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8CC63F" stopOpacity={0.28} /><stop offset="95%" stopColor="#8CC63F" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9eee9" /><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value) => kes(Number(value))} /><Area type="monotone" dataKey="amount" stroke="#005A32" fill="url(#volume)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></article>
      <article className="surface"><div className="section-heading"><div><p className="eyebrow">LOAN PORTFOLIO</p><h2>Application status</h2></div></div><div className="management-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={overview?.loanMix ?? []} dataKey="count" nameKey="status" innerRadius={58} outerRadius={84} paddingAngle={4}>{(overview?.loanMix ?? []).map((item) => <Cell key={item.status} fill={colors[item.status] ?? '#aaa'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="loan-legend">{(overview?.loanMix ?? []).map((item) => <span key={item.status}><i style={{ backgroundColor: colors[item.status] ?? '#aaa' }} />{item.status} <strong>{item.count}</strong></span>)}</div></article></div>
    <AuditFeed rows={transactions.slice(0, 8)} compact />
  </div>;
}

export function AuditLedger() {
  const [rows, setRows] = useState<AuditTransaction[]>([]); const [onlyFlagged, setOnlyFlagged] = useState(false);
  useEffect(() => { let active = true; const load = () => { void api<AuditTransaction[]>('/management/transactions').then((items) => { if (active) setRows(items); }).catch((cause) => notify(cause.message)); }; load(); const timer = window.setInterval(load, 8000); return () => { active = false; window.clearInterval(timer); }; }, []);
  return <div className="view-stack"><div className="ledger-toolbar"><div><p className="eyebrow">LIVE MONITORING</p><h2>Transaction audit ledger</h2></div><label className="toggle-label"><input type="checkbox" checked={onlyFlagged} onChange={(event) => setOnlyFlagged(event.target.checked)} /> Flagged only</label></div><AuditFeed rows={rows.filter((row) => !onlyFlagged || row.flagged)} /></div>;
}

function AuditFeed({ rows, compact = false }: { rows: AuditTransaction[]; compact?: boolean }) {
  return <section className="surface"><div className="section-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>{compact ? 'Latest transactions' : 'Live transaction feed'}</h2></div><span className="live-indicator">LIVE</span></div><div className="table-scroll"><table><thead><tr><th>Time</th><th>Customer</th><th>Transaction</th><th>Reference</th><th>Amount</th><th>Monitor</th></tr></thead><tbody>{rows.map((tx) => <tr key={tx.id}><td>{new Date(tx.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td><td>{tx.customer_name}</td><td>{tx.description}</td><td className="reference-text">{tx.reference}</td><td>{kes(tx.amount_cents / 100)}</td><td>{tx.flagged ? <span className="status-pill warning"><AlertTriangle size={12} /> Review</span> : <span className="status-pill">Clear</span>}</td></tr>)}</tbody></table>{!rows.length && <p className="empty-state">No activity matches the selected filter.</p>}</div></section>;
}

export function CustomerDirectory() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  async function load() { try { setCustomers(await api<Customer[]>('/management/customers')); } catch (cause) { notify(cause instanceof Error ? cause.message : 'Directory unavailable.'); } }
  useEffect(() => { void load(); }, []);
  async function freeze(customer: Customer) {
    const frozen = customer.status !== 'frozen';
    try { await api(`/management/customers/${customer.id}/freeze`, { method: 'POST', body: JSON.stringify({ frozen }) }); notify(`Customer ${frozen ? 'frozen' : 'unfrozen'}.`); await load(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Status change failed.'); }
  }
  async function kyc(customer: Customer, status: string) {
    try { await api(`/staff/customers/${customer.id}/kyc`, { method: 'POST', body: JSON.stringify({ status }) }); notify(`KYC set to ${status}.`); await load(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'KYC update failed.'); }
  }
  return <section className="surface"><div className="section-heading"><div><p className="eyebrow">CUSTOMER OPERATIONS</p><h2>Customer & KYC directory</h2></div><span className="period-label">{customers.length} customers</span></div><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Mobile</th><th>Account status</th><th>KYC status</th><th>Actions</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small className="table-subline">{customer.email}</small></td><td>{customer.phone}</td><td><span className={`status-pill ${customer.status === 'frozen' ? 'warning' : ''}`}>{customer.status}</span></td><td><span className={`status-pill ${customer.kycStatus !== 'approved' ? 'warning' : ''}`}>{customer.kycStatus}</span></td><td className="table-actions"><button className="table-action" onClick={() => void kyc(customer, customer.kycStatus === 'approved' ? 'pending' : 'approved')}>{customer.kycStatus === 'approved' ? 'Reopen KYC' : 'Approve KYC'}</button><button className="table-action danger-action" onClick={() => void freeze(customer)}>{customer.status === 'frozen' ? 'Unfreeze' : 'Freeze'}</button></td></tr>)}</tbody></table></div></section>;
}

export function ManagementSettings() {
  const [dailyLimit, setDailyLimit] = useState(500_000); const [mpesaFee, setMpesaFee] = useState(25); const [transferFee, setTransferFee] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { void api<Record<string, number>>('/management/settings').then((settings) => { setDailyLimit((settings.daily_limit_cents ?? 50_000_000) / 100); setMpesaFee((settings.mpesa_fee_cents ?? 2500) / 100); setTransferFee((settings.transfer_fee_cents ?? 0) / 100); }).catch((cause) => notify(cause.message)); }, []);
  async function save(event: React.FormEvent) { event.preventDefault(); setBusy(true); try { await api('/management/settings', { method: 'PUT', body: JSON.stringify({ dailyLimitKes: dailyLimit, mpesaFeeKes: mpesaFee, transferFeeKes: transferFee }) }); notify('Demo limits and fees saved.'); } catch (cause) { notify(cause instanceof Error ? cause.message : 'Save failed.'); } finally { setBusy(false); } }
  async function reset() { if (!window.confirm('Reset all simulated activity to the original demo data?')) return; try { await api('/management/reset', { method: 'POST', body: '{}' }); notify('Demo data reset. Refreshing the current view.'); window.location.reload(); } catch (cause) { notify(cause instanceof Error ? cause.message : 'Reset failed.'); } }
  return <div className="settings-grid"><section className="surface form-surface"><div className="section-heading"><div><p className="eyebrow">PRODUCT CONTROLS</p><h2>Transfer limits & fees</h2></div></div><form className="form-grid" onSubmit={(event) => void save(event)}><label>Daily transaction limit (KES)<input type="number" min="1" max="2000000" value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} /></label><label>M-Pesa fee (KES)<input type="number" min="0" max="500" step="0.01" value={mpesaFee} onChange={(event) => setMpesaFee(Number(event.target.value))} /></label><label>Other transfer fee (KES)<input type="number" min="0" max="500" step="0.01" value={transferFee} onChange={(event) => setTransferFee(Number(event.target.value))} /></label><button className="primary-button form-wide" disabled={busy}>Save configuration<ArrowUpRight size={17} /></button></form></section><section className="surface reset-panel"><span className="reset-icon"><RotateCcw size={19} /></span><p className="eyebrow">DEMO CONTROLS</p><h2>Reset demo data</h2><p>Restore seeded customers, balances, transactions, and the pending loan application. This removes activity created during the presentation.</p><button className="outline-button danger-button" onClick={() => void reset()}><RotateCcw size={15} /> Reset simulated data</button></section><AuditLog /></div>;
}

function AuditLog() {
  const [logs, setLogs] = useState<Array<{ id: string; actor_name: string; action: string; details: string; created_at: string }>>([]);
  useEffect(() => { void api<typeof logs>('/management/audit').then(setLogs).catch((cause) => notify(cause.message)); }, []);
  return <section className="surface audit-log"><div className="section-heading"><div><p className="eyebrow">SENSITIVE ACTIONS</p><h2>Audit log viewer</h2></div><ArrowDownToLine size={17} /></div><div className="audit-log-list">{logs.slice(0, 12).map((log) => <div className="audit-log-row" key={log.id}><span className="audit-dot" /><span><strong>{log.action.replaceAll('_', ' ')}</strong><small>{log.actor_name ?? 'System'} · {new Date(log.created_at).toLocaleString('en-KE')}</small></span><code>{log.details}</code></div>)}</div></section>;
}
