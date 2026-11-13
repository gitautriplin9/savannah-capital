import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api, setSession, type Role, type SessionUser } from './api';
import { BRAND } from './config';

const demos: Array<{ role: Role; label: string; email: string }> = [
  { role: 'customer', label: 'Customer', email: 'salim.demo@kcbbank.co.ke' },
  { role: 'teller', label: 'Teller', email: 'teller@kcbbank.co.ke' },
  { role: 'loan_officer', label: 'Loan Officer', email: 'loans@kcbbank.co.ke' },
  { role: 'admin', label: 'Management Reviewer', email: 'admin@kcbbank.co.ke' },
];

type LoginProps = { onLogin: (user: SessionUser) => void };
export default function Login({ onLogin }: LoginProps) {
  const [portal, setPortal] = useState<'customer' | 'management'>('customer');
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('salim.demo@kcbbank.co.ke');
  const [phone, setPhone] = useState('+254 700 000 000');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function accept(session: { user: SessionUser; accessToken: string; refreshToken: string }) {
    setSession(session);
    onLogin(session.user);
  }
  async function demo(role: Role) {
    setBusy(true); setError('');
    try { await accept(await api<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/demo-login', { method: 'POST', body: JSON.stringify({ role }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'reset') {
        const payload = await api<{ success: boolean; message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ identifier: email, password }) });
        setError(payload.message);
        setMode('login');
        setPassword('');
        return;
      }

      const payload = mode === 'register'
        ? await api<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, phone, password }) })
        : await api<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: email, password }) });
      await accept(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  }

  const options = demos;
  return <main className="login-page">
    <div className="login-art" aria-hidden="true"><div className="art-rings" /><span className="art-mark">{BRAND.logoText}</span><div className="art-caption"><span>WEALTH,</span><strong>REIMAGINED.</strong></div><div className="art-index">PRIVATE CAPITAL · KENYA</div></div>
    <section className="login-panel">
      <div className="login-brand"><span className="brand-mark">{BRAND.logoText}</span><div><strong>{BRAND.name}</strong><span>Private wealth</span></div></div>
      <div className="login-heading"><p className="eyebrow">WELCOME TO SAVANNAH CAPITAL</p><h1>Grow with confidence.</h1><p>{mode === 'login' ? 'Access your client workspace and manage your wealth.' : mode === 'register' ? 'Create a new client profile and start building your future.' : 'Reset your password with your email or phone number.'}</p></div>
      <div className="portal-switch" role="tablist" aria-label="Choose portal">
        <button type="button" className={portal === 'customer' ? 'active' : ''} onClick={() => { setPortal('customer'); setEmail('salim.demo@kcbbank.co.ke'); setPassword('Password123!'); }}>Customer Portal</button>
        <button type="button" className={portal === 'management' ? 'active' : ''} onClick={() => { setPortal('management'); setEmail('admin@kcbbank.co.ke'); setPassword('Admin123!'); }}>Management Portal</button>
      </div>
      <div className="portal-switch" role="tablist" aria-label="Authentication mode" style={{ marginTop: '0.75rem' }}>
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
        <button type="button" className={mode === 'reset' ? 'active' : ''} onClick={() => { setMode('reset'); setPassword(''); }}>Reset password</button>
      </div>
      <form className="login-form" onSubmit={submit}>
        {mode === 'register' && <label>Full name<input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Wanjiku" required /></label>}
        <label>{mode === 'reset' ? 'Email or phone number' : 'Email address'}<input type={mode === 'reset' ? 'text' : 'email'} autoComplete={mode === 'reset' ? 'username' : 'username'} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        {mode === 'register' && <label>Phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254 700 123 456" required /></label>}
        {mode !== 'reset' ? <label>Password<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : ''} required /></label> : <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Choose a new password" required /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button login-submit" disabled={busy}>{busy ? (mode === 'register' ? 'Creating account…' : mode === 'reset' ? 'Resetting…' : 'Signing in…') : (mode === 'register' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in')}<ArrowRight size={17} /></button>
      </form>
      <div className="demo-login"><div className="demo-title"><span>DEMO ACCESS</span><span className="demo-dot" /></div><div className="demo-buttons">{options.map((demoUser) => <button key={demoUser.role} type="button" onClick={() => void demo(demoUser.role)} disabled={busy}><span className="demo-role">{demoUser.label}</span><span>1-click login</span><ArrowRight size={14} /></button>)}</div></div>
      <p className="login-security"><ShieldCheck size={15} /> Secure demo environment · No real funds</p>
      <div className="login-foot">© 2026 Savannah Capital · Private wealth demo</div>
    </section>
  </main>;
}
