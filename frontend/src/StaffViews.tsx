import { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { api, type Loan } from './api';
import { kes } from './config';
const notify = (message: string) => window.dispatchEvent(new CustomEvent('demo-toast', { detail: message }));
type Customer = { id: string; name: string; email: string; phone: string; status: string; kycStatus: string; balanceCents: number };

export function TellerDesk() {
  const [customers, setCustomers] = useState<Customer[]>([]); const [query, setQuery] = useState(''); const [selected, setSelected] = useState<Customer | null>(null);
  const [amount, setAmount] = useState(''); const [description, setDescription] = useState('Cash deposit'); const [busy, setBusy] = useState(false);
  async function search() { try { const rows = await api<Customer[]>(`/staff/customers?q=${encodeURIComponent(query)}`); setCustomers(rows); } catch (cause) { notify(cause instanceof Error ? cause.message : 'Lookup failed.'); } }
  useEffect(() => { void search(); }, []);
  async function deposit(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return; setBusy(true);
    try { const result = await api<{ reference: string }>('/staff/deposit', { method: 'POST', body: JSON.stringify({ userId: selected.id, amount: Number(amount), description, idempotencyKey: crypto.randomUUID() }) }); notify(`Deposit posted · ${result.reference}`); setAmount(''); await search(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Deposit failed.'); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    if (!selected) return;
    setBusy(true);
    try { const result = await api<{ reference: string }>('/staff/withdraw', { method: 'POST', body: JSON.stringify({ userId: selected.id, amount: Number(amount), idempotencyKey: crypto.randomUUID() }) }); notify(`Withdrawal posted · ${result.reference}`); setAmount(''); await search(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Withdrawal failed.'); }
    finally { setBusy(false); }
  }
  async function kyc(customer: Customer, status: string) {
    try { await api(`/staff/customers/${customer.id}/kyc`, { method: 'POST', body: JSON.stringify({ status }) }); notify(`KYC status updated to ${status}.`); await search(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'KYC update failed.'); }
  }
  return <div className="staff-grid"><section className="surface"><div className="section-heading"><div><p className="eyebrow">BRANCH OPERATIONS</p><h2>Customer lookup</h2></div></div><form className="search-bar" onSubmit={(event) => { event.preventDefault(); void search(); }}><Search size={17} /><input placeholder="Name, email or mobile" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="outline-button">Search</button></form><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Mobile</th><th>Balance</th><th>KYC</th><th>Actions</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><button className="customer-select" onClick={() => setSelected(customer)}><strong>{customer.name}</strong><small>{customer.email}</small></button></td><td>{customer.phone}</td><td>{kes(customer.balanceCents / 100)}</td><td><span className={`status-pill ${customer.kycStatus !== 'approved' ? 'warning' : ''}`}>{customer.kycStatus}</span></td><td><button className="table-action" onClick={() => void kyc(customer, customer.kycStatus === 'approved' ? 'pending' : 'approved')}>{customer.kycStatus === 'approved' ? 'Reopen KYC' : 'Approve KYC'}</button></td></tr>)}</tbody></table></div></section>
    <aside className="surface teller-side"><p className="eyebrow">CASH SERVICES</p><h2>{selected ? selected.name : 'Select a customer'}</h2><p>{selected ? `Current balance: ${kes(selected.balanceCents / 100)}` : 'Choose a customer from the directory to make a simulated cash deposit or withdrawal.'}</p><form className="form-grid" onSubmit={deposit}><label className="form-wide">Transaction amount (KES)<input type="number" min="1" max="500000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label className="form-wide">Deposit description<input value={description} onChange={(event) => setDescription(event.target.value)} minLength={3} /></label><button className="primary-button form-wide" disabled={!selected || busy}>Post cash deposit</button><button type="button" className="outline-button form-wide" disabled={!selected || busy || !amount} onClick={() => void withdraw()}>Post cash withdrawal</button></form><p className="aside-note">Withdrawals require sufficient available balance and are recorded in the ledger.</p></aside></div>;
}

export function LoanQueue() {
  const [loans, setLoans] = useState<Loan[]>([]); const [comment, setComment] = useState('');
  async function load() { try { setLoans(await api<Loan[]>('/loans')); } catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not load queue.'); } }
  useEffect(() => { void load(); }, []);
  async function review(loan: Loan, decision: 'approved' | 'rejected') {
    try { await api(`/loans/${loan.id}/review`, { method: 'POST', body: JSON.stringify({ decision, comment }) }); notify(`Loan ${decision}.`); setComment(''); await load(); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'Decision failed.'); }
  }
  const pending = loans.filter((loan) => loan.status === 'pending');
  return <div className="view-stack"><section className="surface"><div className="section-heading"><div><p className="eyebrow">CREDIT OPERATIONS</p><h2>Loan review queue</h2></div><span className="status-pill warning">{pending.length} pending</span></div>{pending.length ? <div className="loan-queue">{pending.map((loan) => <article className="loan-review-row" key={loan.id}><div className="loan-review-head"><div><strong>{loan.customer_name ?? 'Customer'}</strong><small>{loan.purpose} · {new Date(loan.created_at).toLocaleDateString('en-KE')}</small></div><strong>{kes(loan.amount_cents / 100)}</strong></div><div className="loan-review-meta"><span>{loan.tenure_months} months</span><span>{loan.rate_percent}% annual rate</span><span>Estimated payment {kes(monthlyPayment(loan.amount_cents / 100, loan.tenure_months))}</span></div><label>Decision comment<input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional reviewer note" maxLength={240} /></label><div className="review-actions"><button className="outline-button reject-button" onClick={() => void review(loan, 'rejected')}><X size={15} /> Reject</button><button className="primary-button" onClick={() => void review(loan, 'approved')}><Check size={15} /> Approve & disburse</button></div></article>)}</div> : <p className="empty-state">No pending applications.</p>}</section></div>;
}
function monthlyPayment(principal: number, months: number) { const rate = 0.13 / 12; return principal * rate / (1 - (1 + rate) ** -months); }
