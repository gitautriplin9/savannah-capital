import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, HandCoins, ShieldCheck, Users } from 'lucide-react';
import { api, setSession, staffApiAvailable, type Role, type SessionUser } from './api';
import { BRAND } from './config';

type AuthMode = 'login' | 'register' | 'reset';
type LoginProps = { onLogin: (user: SessionUser) => void; initialMode?: AuthMode; teamAccess?: boolean };
type TeamRole = Exclude<Role, 'customer'>;
const teamRoles: Array<{ role: TeamRole; title: string; description: string; icon: typeof Users }> = [
  { role: 'teller', title: 'Branch agent', description: 'Customer service & teller desk', icon: Users },
  { role: 'loan_officer', title: 'Lending officer', description: 'Review lending applications', icon: HandCoins },
  { role: 'admin', title: 'Manager', description: 'Branch oversight & reporting', icon: Building2 },
];

export default function Login({ onLogin, initialMode = 'login', teamAccess = false }: LoginProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [selectedRole, setSelectedRole] = useState<TeamRole>('teller');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setMode(initialMode), [initialMode]);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError('');
    setMessage('');
    navigate(next === 'register' ? '/create-account' : next === 'reset' ? '/password-recovery' : '/login');
  }

  async function accept(session: { user: SessionUser; accessToken: string; refreshToken: string }) {
    setSession(session);
    onLogin(session.user);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'reset') {
        const result = await api<{ message: string }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ identifier: email, password }),
        });
        setPassword('');
        setMessage(result.message);
        return;
      }

      const session = mode === 'register'
        ? await api<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, phone, password }),
        })
        : await api<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier: email, password, ...(teamAccess ? { expectedRole: selectedRole } : {}) }),
        });
      if (teamAccess && session.user.role !== selectedRole) {
        throw new Error('These credentials do not match the selected team workspace.');
      }
      await accept(session);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <div className="login-art" aria-hidden="true"><div className="art-rings" /><span className="art-mark">{BRAND.logoText}</span><div className="art-caption"><span>WEALTH,</span><strong>REIMAGINED.</strong></div><div className="art-index">PRIVATE CAPITAL · KENYA</div></div>
    <section className="login-panel">
      <div className="login-brand"><span className="brand-mark">{BRAND.logoText}</span><div><strong>{BRAND.name}</strong><span>Private wealth</span></div></div>
      <div className="login-heading"><p className="eyebrow">{teamAccess ? 'SAVANNAH CAPITAL · TEAM ACCESS' : 'WELCOME TO SAVANNAH CAPITAL'}</p><h1>{teamAccess ? 'Your team workspace.' : mode === 'register' ? 'Create your account.' : mode === 'reset' ? 'Reset your password.' : 'Grow with confidence.'}</h1><p>{teamAccess ? 'Sign in with your organization-issued account to open your assigned workspace.' : mode === 'login' ? 'Access your client workspace and manage your wealth.' : mode === 'register' ? 'Create a client profile to get started.' : 'Set a new password for your account.'}</p></div>
      {teamAccess ? <div className="team-role-picker" aria-label="Choose team workspace">
        {teamRoles.map(({ role, title, description, icon: Icon }) => <button key={role} type="button" className={selectedRole === role ? 'active' : ''} aria-pressed={selectedRole === role} onClick={() => setSelectedRole(role)}>
          <Icon size={17} /><span><strong>{title}</strong><small>{description}</small></span>
        </button>)}
      </div> : <div className="portal-switch" role="tablist" aria-label="Authentication mode" style={{ marginTop: '0.75rem' }}>
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Create account</button>
        <button type="button" className={mode === 'reset' ? 'active' : ''} onClick={() => changeMode('reset')}>Reset password</button>
      </div>}
      {teamAccess && !staffApiAvailable && <p className="api-unavailable" role="status">Team sign-in is not enabled on this deployment yet. The secure staff API must be connected by the site administrator.</p>}
      <form className="login-form" onSubmit={submit}>
        {mode === 'register' && <label>Full name<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>}
        <label>{mode === 'reset' ? 'Email or phone number' : 'Email address'}<input type={mode === 'reset' ? 'text' : 'email'} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        {mode === 'register' && <label>Phone number<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>}
        <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {message && <p className="form-success" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button login-submit" disabled={busy || (teamAccess && !staffApiAvailable)}>{busy ? (mode === 'register' ? 'Creating account…' : mode === 'reset' ? 'Resetting…' : 'Signing in…') : (mode === 'register' ? 'Create account' : mode === 'reset' ? 'Reset password' : teamAccess ? 'Continue to team workspace' : 'Sign in')}<ArrowRight size={17} /></button>
      </form>
      <p className="login-security"><ShieldCheck size={15} /> {teamAccess ? 'Employee access is role-restricted and audited.' : 'Savannah Capital simulated experience · No real funds'}</p>
      <div className="login-foot">© 2026 Savannah Capital · Private wealth</div>
      {!teamAccess && mode === 'login' && <p className="login-foot">New to Savannah Capital? <Link to="/create-account">Create an account</Link></p>}
    </section>
  </main>;
}
