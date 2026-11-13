import { useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { BRAND } from './config';
import { phoneAuthEnabled, supabase } from './supabase';

type Mode = 'signin' | 'signup' | 'phone' | 'recovery';

export default function AccountAuth() {
  const [mode, setMode] = useState<Mode>('signin');
  const [phoneStep, setPhoneStep] = useState<'request' | 'verify'>('request');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const client = supabase;
    if (!client) {
      setError('Customer accounts are not configured yet.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (authError) throw authError;
        setMessage(data.session ? 'Your account is ready.' : 'Check your email to confirm your account.');
      } else if (mode === 'signin') {
        const { error: authError } = await client.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (authError) throw authError;
      } else if (mode === 'recovery') {
        const { error: authError } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        setMessage('If an account exists for that email, a secure reset link has been sent.');
      } else if (phoneStep === 'request') {
        const { error: authError } = await client.auth.signInWithOtp({
          phone: phone.trim(),
          options: { shouldCreateUser: false },
        });
        if (authError) throw authError;
        setPhoneStep('verify');
        setMessage('Enter the one-time code sent to your phone.');
      } else {
        const { error: authError } = await client.auth.verifyOtp({
          phone: phone.trim(),
          token: code.trim(),
          type: 'sms',
        });
        if (authError) throw authError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not complete that request.');
    } finally {
      setBusy(false);
    }
  }

  function chooseMode(next: Mode) {
    setMode(next);
    setPhoneStep('request');
    setCode('');
    setPassword('');
    setMessage('');
    setError('');
  }

  if (!supabase) {
    return <main className="login-page">
      <section className="login-panel">
        <BrandHeader />
        <div className="login-heading">
          <p className="eyebrow">CUSTOMER ACCOUNTS</p>
          <h1>Account services are not configured.</h1>
          <p>Add the Supabase project URL and public anon key to the deployment environment to enable secure sign-in.</p>
        </div>
      </section>
    </main>;
  }

  const isPhone = mode === 'phone';
  const isPassword = mode === 'signin' || mode === 'signup';

  return <main className="login-page">
    <div className="login-art" aria-hidden="true">
      <div className="art-rings" />
      <span className="art-mark">{BRAND.logoText}</span>
      <div className="art-caption"><span>WEALTH,</span><strong>REIMAGINED.</strong></div>
      <div className="art-index">PRIVATE CAPITAL · KENYA</div>
    </div>
    <section className="login-panel">
      <BrandHeader />
      <div className="login-heading">
        <p className="eyebrow">CUSTOMER ACCOUNTS</p>
        <h1>{mode === 'signup' ? 'Create your account.' : mode === 'recovery' ? 'Reset your password.' : 'Welcome back.'}</h1>
        <p>Secure access to your Savannah Capital customer profile.</p>
      </div>
      <div className="portal-switch" role="tablist" aria-label="Account access method">
        <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => chooseMode('signin')}>Email</button>
        <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => chooseMode('signup')}>Create account</button>
        {phoneAuthEnabled && <button type="button" className={mode === 'phone' ? 'active' : ''} onClick={() => chooseMode('phone')}>Phone code</button>}
      </div>
      {mode === 'recovery' && <p className="eyebrow" style={{ marginTop: '0.8rem' }}>EMAIL RECOVERY</p>}
      <form className="login-form" onSubmit={submit}>
        {mode === 'signup' && <label>Full name<input type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
        {isPhone ? <>
          <label>Phone number<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+254 700 123 456" autoComplete="tel" required /></label>
          {phoneStep === 'verify' && <label>One-time code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label>}
        </> : <>
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          {isPassword && <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required /></label>}
        </>}
        {message && <p className="form-success" role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button login-submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'recovery' ? 'Send reset link' : isPhone ? phoneStep === 'request' ? 'Send code' : 'Verify code' : 'Sign in'}
          <ArrowRight size={17} />
        </button>
      </form>
      {mode === 'signin' && <button className="text-button" type="button" onClick={() => chooseMode('recovery')}>Forgot password?</button>}
      {mode === 'recovery' && <button className="text-button" type="button" onClick={() => chooseMode('signin')}>Back to sign in</button>}
      <p className="login-security"><ShieldCheck size={15} /> {phoneAuthEnabled ? 'Email confirmation and phone codes protect your account.' : 'Email confirmation protects your account.'}</p>
      <div className="login-foot">© 2026 {BRAND.name} · Customer accounts</div>
    </section>
  </main>;
}

function BrandHeader() {
  return <div className="login-brand"><span className="brand-mark">{BRAND.logoText}</span><div><strong>{BRAND.name}</strong><span>Private wealth</span></div></div>;
}