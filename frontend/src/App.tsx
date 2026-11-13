import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeftRight, Bell, Building2, ChevronDown, CircleDollarSign, CreditCard, FileText, Gauge, HandCoins, LogOut, Menu, Settings, ShieldCheck, Users, X } from 'lucide-react';
import Login from './Login';
import { getSession, setSession, type Role, type SessionUser } from './api';
import { BRAND } from './config';
import { CardsView, CustomerOverview, LoansView, NotificationsView, SettingsView, StatementsView, TransferView } from './CustomerViews';
import { AuditLedger, CustomerDirectory, ManagementOverview, ManagementSettings } from './ManagementViews';
import { LoanQueue, TellerDesk } from './StaffViews';

type NavItem = { label: string; path: string; icon: React.ReactNode };
const customerNav: NavItem[] = [
  { label: 'Overview', path: '/app/overview', icon: <Gauge size={17} /> },
  { label: 'Transfers & payments', path: '/app/transfers', icon: <ArrowLeftRight size={17} /> },
  { label: 'Loans', path: '/app/loans', icon: <HandCoins size={17} /> },
  { label: 'Statements', path: '/app/statements', icon: <FileText size={17} /> },
  { label: 'Cards', path: '/app/cards', icon: <CreditCard size={17} /> },
  { label: 'Notifications', path: '/app/notifications', icon: <Bell size={17} /> },
  { label: 'Settings', path: '/app/settings', icon: <Settings size={17} /> },
];
const managementNav: NavItem[] = [
  { label: 'Executive overview', path: '/app/overview', icon: <Gauge size={17} /> },
  { label: 'Audit ledger', path: '/app/audit', icon: <Activity size={17} /> },
  { label: 'Customers & KYC', path: '/app/customers', icon: <Users size={17} /> },
  { label: 'Loan queue', path: '/app/loan-queue', icon: <HandCoins size={17} /> },
  { label: 'Teller desk', path: '/app/teller', icon: <Building2 size={17} /> },
  { label: 'Configuration', path: '/app/configuration', icon: <Settings size={17} /> },
];
const pageTitles: Record<string, string> = {
  '/app/overview': 'Overview', '/app/transfers': 'Transfers & payments', '/app/loans': 'Loans', '/app/statements': 'Statements', '/app/cards': 'Cards', '/app/notifications': 'Notifications', '/app/settings': 'Settings', '/app/audit': 'Audit ledger', '/app/customers': 'Customers & KYC', '/app/loan-queue': 'Loan review queue', '/app/teller': 'Teller desk', '/app/configuration': 'Configuration',
};

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getSession()?.user ?? null);
  const navigate = useNavigate();
  function loggedIn(next: SessionUser) { setUser(next); navigate('/app/overview'); }
  function logout() { setSession(null); setUser(null); navigate('/login'); }
  return <>
    <div className="prototype-banner"><ShieldCheck size={14} /><span><strong>Savannah Capital</strong> <i /> Private wealth platform</span><span className="banner-separator">Demo experience · No real money · No live integrations</span></div>
    <ToastHost />
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/app/overview" replace /> : <Login onLogin={loggedIn} />} />
      <Route path="/app/*" element={user ? <Portal user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={user ? '/app/overview' : '/login'} replace />} />
    </Routes>
  </>;
}

function Portal({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const nav = user.role === 'customer' ? customerNav : user.role === 'teller' ? managementNav.filter((item) => ['/app/teller', '/app/customers'].includes(item.path)) : user.role === 'loan_officer' ? managementNav.filter((item) => ['/app/loan-queue', '/app/audit'].includes(item.path)) : managementNav;
  const title = pageTitles[location.pathname] ?? 'Overview';
  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}><div className="sidebar-brand"><span className="brand-mark">{BRAND.logoText}</span><span><strong>{BRAND.name}</strong><small>Private wealth</small></span><button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div><div className="portal-label">{user.role === 'customer' ? 'CLIENT PORTAL' : 'WEALTH TEAM'}</div><nav className="side-nav">{nav.map((item) => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={location.pathname === item.path ? 'active' : ''}>{item.icon}<span>{item.label}</span>{location.pathname === item.path && <i />}</Link>)}</nav><div className="sidebar-bottom"><div className="support-line"><span className="support-icon"><CircleDollarSign size={16} /></span><span><strong>Need assistance?</strong><small>Call 0711 087 000</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /> Sign out</button><small className="sidebar-demo">PRIVATE WEALTH DEMO ENVIRONMENT</small></div></aside>
    <main className="main-area"><header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="crumb"><span>{user.role === 'customer' ? 'Client Portal' : 'Wealth Team'}</span><i>/</i><strong>{title}</strong></div><div className="topbar-right"><span className="top-date">{new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>{user.role === 'customer' && <Link className="icon-button notification-button" to="/app/notifications" title="Notifications"><Bell size={18} /><i /></Link>}<div className="user-menu"><span className="user-avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{user.name}</strong><small>{roleName(user.role)}</small></span><ChevronDown size={15} /></div></div></header><div className="page-content"><div className="page-title-row"><div><p className="eyebrow">{user.role === 'customer' ? 'YOUR WEALTH' : 'OPERATIONS & INSIGHT'}</p><h1>{title}</h1></div>{user.role === 'customer' && location.pathname === '/app/overview' && <Link className="outline-button" to="/app/transfers"><ArrowLeftRight size={15} /> New transfer</Link>}</div><PortalContent role={user.role} path={location.pathname} /></div><footer className="app-footer"><span>© 2026 {BRAND.name} · Private wealth platform</span><span>Secure demo session <ShieldCheck size={13} /></span></footer></main>
  </div>;
}

function PortalContent({ role, path }: { role: Role; path: string }) {
  if (role === 'customer') {
    if (path === '/app/overview') return <CustomerOverview />;
    if (path === '/app/transfers') return <TransferView />;
    if (path === '/app/loans') return <LoansView />;
    if (path === '/app/statements') return <StatementsView />;
    if (path === '/app/cards') return <CardsView />;
    if (path === '/app/notifications') return <NotificationsView />;
    return <SettingsView />;
  }
  if (path === '/app/loan-queue') return <LoanQueue />;
  if (path === '/app/teller') return <TellerDesk />;
  if (path === '/app/audit') return <AuditLedger />;
  if (path === '/app/customers') return <CustomerDirectory />;
  if (path === '/app/configuration') return <ManagementSettings />;
  return <ManagementOverview />;
}
function roleName(role: Role) { return ({ customer: 'Personal banking', teller: 'Branch teller', loan_officer: 'Loan officer', admin: 'Management reviewer' })[role]; }

function ToastHost() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let timer = 0;
    const show = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(''), 5500);
    };
    window.addEventListener('demo-toast', show);
    return () => { window.removeEventListener('demo-toast', show); window.clearTimeout(timer); };
  }, []);
  return message ? <div className="toast-message" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={15} /></button></div> : null;
}
