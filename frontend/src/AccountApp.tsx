import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogOut, ShieldCheck } from 'lucide-react';
import { BRAND } from './config';
import AccountAuth from './AccountAuth';
import { phoneAuthEnabled, supabase } from './supabase';
import './account.css';

export default function AccountApp() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setReady(true);
      return;
    }

    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!ready) return <main className="login-page"><p role="status">Loading account…</p></main>;
  const client = supabase;
  if (!client || !user) return <AccountAuth />;
  if (passwordRecovery) return <PasswordRecovery onComplete={() => setPasswordRecovery(false)} />;
  return <AccountHome user={user} onSignOut={() => void client.auth.signOut()} />;
}

function AccountHome({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [name, setName] = useState(String(user.user_metadata.full_name ?? ''));
  const [phone, setPhone] = useState(user.phone ?? '');
  const [pendingPhone, setPendingPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    void client.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data, error: profileError }) => {
      if (profileError) setError('Profile storage is not ready. Apply the Supabase schema before onboarding customers.');
      else if (data?.full_name) setName(data.full_name);
    });
  }, [user.id]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const { error: updateError } = await client.from('profiles').update({ full_name: name.trim() }).eq('id', user.id);
      if (updateError) throw updateError;
      setMessage('Profile updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile update failed.');
    } finally { setBusy(false); }
  }

  async function sendPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const { error: updateError } = await client.auth.updateUser({ phone: phone.trim() });
      if (updateError) throw updateError;
      setPendingPhone(phone.trim());
      setMessage('Enter the code sent to your phone to verify this number.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a verification code.');
    } finally { setBusy(false); }
  }

  async function verifyPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const { error: verifyError } = await client.auth.verifyOtp({ phone: pendingPhone, token: phoneCode.trim(), type: 'phone_change' });
      if (verifyError) throw verifyError;
      setPendingPhone(''); setPhoneCode(''); setMessage('Phone number verified.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Phone verification failed.');
    } finally { setBusy(false); }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword(''); setMessage('Password updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password update failed.');
    } finally { setBusy(false); }
  }

  return <div className="app-shell">
    <main className="main-area">
      <header className="topbar">
        <div className="crumb"><strong>{BRAND.name}</strong><i>/</i><span>Customer account</span></div>
        <button className="logout-button" onClick={onSignOut}><LogOut size={17} /> Sign out</button>
      </header>
      <div className="page-content">
        <div className="page-title-row"><div><p className="eyebrow">CUSTOMER PROFILE</p><h1>Your account</h1></div></div>
        <div className="account-grid account-grid--profile">
          <section className="account-card">
            <div className="section-heading"><div><p className="eyebrow">PERSONAL DETAILS</p><h2>Profile</h2></div></div>
            <form className="login-form" onSubmit={saveProfile}>
              <label>Full name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <label>Email address<input value={user.email ?? ''} readOnly /></label>
              <label>Email status<input value={user.email_confirmed_at ? 'Verified' : 'Confirmation pending'} readOnly /></label>
              <button className="primary-button" disabled={busy}>Save profile</button>
            </form>
            {phoneAuthEnabled ? <form className="login-form" onSubmit={pendingPhone ? verifyPhone : sendPhoneCode}>
              <label>Phone number<input type="tel" autoComplete="tel" value={pendingPhone || phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254 700 123 456" required /></label>
              {pendingPhone && <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} required /></label>}
              <button className="outline-button" disabled={busy}>{pendingPhone ? 'Verify phone' : user.phone_confirmed_at ? 'Update phone' : 'Verify phone'}</button>
            </form> : <p className="account-notice">Phone verification becomes available after SMS delivery is configured.</p>}
            <form className="login-form" onSubmit={updatePassword}>
              <label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <button className="outline-button" disabled={busy}>Update password</button>
            </form>
            {message && <p className="form-success" role="status">{message}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </section>
          <section className="account-card">
            <div className="section-heading"><div><p className="eyebrow">ACCOUNT STATUS</p><h2>Identity</h2></div><ShieldCheck size={19} /></div>
            <p>Email: {user.email_confirmed_at ? 'verified' : 'confirmation required'}</p>
            <p>Phone: {phoneAuthEnabled ? user.phone_confirmed_at ? 'verified' : 'not verified' : 'verification not configured'}</p>
            <p className="account-notice">Money movement and financial products are disabled until a licensed provider is integrated.</p>
          </section>
        </div>
      </div>
    </main>
  </div>;
}

function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Password updated.');
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password update failed.');
    } finally { setBusy(false); }
  }

  return <main className="login-page">
    <section className="login-panel">
      <div className="login-brand"><span className="brand-mark">{BRAND.logoText}</span><div><strong>{BRAND.name}</strong><span>Private wealth</span></div></div>
      <div className="login-heading"><p className="eyebrow">SECURE ACCOUNT RECOVERY</p><h1>Choose a new password.</h1></div>
      <form className="login-form" onSubmit={submit}>
        <label>New password<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {message && <p className="form-success" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Updating…' : 'Save new password'}</button>
      </form>
    </section>
  </main>;
}