import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeftRight, Bell, Building2, ChevronDown, CircleDollarSign, CreditCard, FileText, Gauge, HandCoins, LogOut, Menu, Settings, ShieldCheck, Users, WalletCards, X } from 'lucide-react';
import Login from './Login';
import { getSession, setSession, type Role, type SessionUser } from './api';
import { BRAND } from './config';
import { AccountsView, BillPaymentsView, CardsView, CustomerOverview, LoansView, NotificationsView, ProfileView, SettingsView, StatementsView, TransferView } from './CustomerViews';
import { AuditLedger, CustomerDirectory, ManagementOverview, ManagementSettings } from './ManagementViews';
import { LoanQueue, TellerDesk } from './StaffViews';

type NavItem = { label: string; path: string; icon: React.ReactNode };
const customerNav: NavItem[] = [
  { label: 'Overview', path: '/app/overview', icon: <Gauge size={17} /> },
  { label: 'Accounts', path: '/app/accounts', icon: <WalletCards size={17} /> },
  { label: 'Transfers & payments', path: '/app/transfers', icon: <ArrowLeftRight size={17} /> },
  { label: 'Bill payments', path: '/app/bills', icon: <FileText size={17} /> },
  { label: 'Loans', path: '/app/loans', icon: <HandCoins size={17} /> },
  { label: 'Statements', path: '/app/statements', icon: <FileText size={17} /> },
  { label: 'Cards', path: '/app/cards', icon: <CreditCard size={17} /> },
  { label: 'Notifications', path: '/app/notifications', icon: <Bell size={17} /> },
  { label: 'Profile', path: '/app/profile', icon: <Users size={17} /> },
  { label: 'Settings', path: '/app/settings', icon: <Settings size={17} /> },
];
const managementNav: NavItem[] = [
  { label: 'Executive overview', path: '/app/overview', icon: <Gauge size={17} /> },
  { label: 'Audit ledger', path: '/app/audit', icon: <Activity size={17} /> },
  { label: 'Customers', path: '/app/customers', icon: <Users size={17} /> },
  { label: 'Loan queue', path: '/app/loan-queue', icon: <HandCoins size={17} /> },
  { label: 'Teller desk', path: '/app/teller', icon: <Building2 size={17} /> },
  { label: 'Configuration', path: '/app/configuration', icon: <Settings size={17} /> },
];
const pageTitles: Record<string, string> = {
  '/app/overview': 'Overview', '/app/accounts': 'Accounts', '/app/transfers': 'Transfers & payments', '/app/bills': 'Bill payments', '/app/loans': 'Loans', '/app/statements': 'Statements', '/app/cards': 'Cards', '/app/notifications': 'Notifications', '/app/profile': 'Profile', '/app/settings': 'Settings', '/app/audit': 'Audit ledger', '/app/customers': 'Customers', '/app/loan-queue': 'Loan review queue', '/app/teller': 'Teller desk', '/app/configuration': 'Configuration',
};

export default function App({ basePath = '', teamAccess = false }: { basePath?: string; teamAccess?: boolean }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const savedUser = getSession()?.user ?? null;
    return teamAccess && savedUser?.role === 'customer' ? null : savedUser;
  });
  const navigate = useNavigate();
  const loginPath = `${basePath}/login`;
  const overviewPath = `${basePath}/app/overview`;
  function loggedIn(next: SessionUser) { setUser(next); navigate(overviewPath); }
  function logout() { setSession(null); setUser(null); navigate(loginPath); }
  return <>
    <div className="prototype-banner"><ShieldCheck size={14} /><span><strong>Savannah Capital</strong> <i /> Private wealth platform</span><span className="banner-separator">Simulated activity · No real money · No live integrations</span></div>
    <ToastHost />
    <Routes>
      <Route path={loginPath} element={user ? <Navigate to={overviewPath} replace /> : <Login teamAccess={teamAccess} onLogin={loggedIn} />} />
      {!teamAccess && <>
        <Route path="/create-account" element={user ? <Navigate to={overviewPath} replace /> : <Login initialMode="register" onLogin={loggedIn} />} />
        <Route path="/password-recovery" element={user ? <Navigate to={overviewPath} replace /> : <Login initialMode="reset" onLogin={loggedIn} />} />
      </>}
      <Route path={`${basePath}/app/*`} element={user ? <Portal basePath={basePath} user={user} onLogout={logout} /> : <Navigate to={loginPath} replace />} />
      <Route path="*" element={<Navigate to={user ? overviewPath : loginPath} replace />} />
    </Routes>
  </>;
}

function Portal({ basePath, user, onLogout }: { basePath: string; user: SessionUser; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const routePath = basePath && location.pathname.startsWith(basePath) ? location.pathname.slice(basePath.length) || '/' : location.pathname;
  const baseNav = user.role === 'customer' ? customerNav : user.role === 'teller' ? managementNav.filter((item) => item.path === '/app/teller') : user.role === 'loan_officer' ? managementNav.filter((item) => item.path === '/app/loan-queue') : managementNav;
  const nav = baseNav.map((item) => ({ ...item, path: `${basePath}${item.path}` }));
  const title = pageTitles[routePath] ?? 'Overview';
  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}><div className="sidebar-brand"><span className="brand-mark">{BRAND.logoText}</span><span><strong>{BRAND.name}</strong><small>Private wealth</small></span><button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div><div className="portal-label">{user.role === 'customer' ? 'CLIENT PORTAL' : 'WEALTH TEAM'}</div><nav className="side-nav">{nav.map((item) => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={location.pathname === item.path ? 'active' : ''}>{item.icon}<span>{item.label}</span>{location.pathname === item.path && <i />}</Link>)}</nav><div className="sidebar-bottom"><div className="support-line"><span className="support-icon"><CircleDollarSign size={16} /></span><span><strong>Need assistance?</strong><small>Call 0711 087 000</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /> Sign out</button><small className="environment-note">SAVANNAH CAPITAL SIMULATED ENVIRONMENT</small></div></aside>
    <main className="main-area"><header className="topbar"><button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="crumb"><span>{user.role === 'customer' ? 'Client Portal' : 'Wealth Team'}</span><i>/</i><strong>{title}</strong></div><div className="topbar-right"><span className="top-date">{new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>{user.role === 'customer' && <Link className="icon-button notification-button" to={`${basePath}/app/notifications`} title="Notifications"><Bell size={18} /><i /></Link>}<div className="user-menu"><span className="user-avatar">{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{user.name}</strong><small>{roleName(user.role)}</small></span><ChevronDown size={15} /></div></div></header><div className="page-content"><div className="page-title-row"><div><p className="eyebrow">{user.role === 'customer' ? 'YOUR WEALTH' : 'OPERATIONS & INSIGHT'}</p><h1>{title}</h1></div>{user.role === 'customer' && routePath === '/app/overview' && <Link className="outline-button" to={`${basePath}/app/transfers`}><ArrowLeftRight size={15} /> New transfer</Link>}</div><PortalContent basePath={basePath} role={user.role} path={routePath} /></div><footer className="app-footer"><span>© 2026 {BRAND.name} · Private wealth platform</span><span>Secure session <ShieldCheck size={13} /></span></footer></main>
  </div>;
}

function PortalContent({ basePath, role, path }: { basePath: string; role: Role; path: string }) {
  if (role === 'customer') {
    if (path === '/app/overview') return <CustomerOverview />;
    if (path === '/app/accounts') return <AccountsView />;
    if (path === '/app/transfers') return <TransferView />;
    if (path === '/app/bills') return <BillPaymentsView />;
    if (path === '/app/loans') return <LoansView />;
    if (path === '/app/statements') return <StatementsView />;
    if (path === '/app/cards') return <CardsView />;
    if (path === '/app/notifications') return <NotificationsView />;
    if (path === '/app/profile') return <ProfileView />;
    if (path === '/app/settings') return <SettingsView />;
    return <Navigate to="/app/overview" replace />;
  }
  if (role === 'teller') return path === '/app/teller' ? <TellerDesk /> : <Navigate to={`${basePath}/app/teller`} replace />;
  if (role === 'loan_officer') return path === '/app/loan-queue' ? <LoanQueue /> : <Navigate to={`${basePath}/app/loan-queue`} replace />;
  if (path === '/app/loan-queue') return <LoanQueue />;
  if (path === '/app/teller') return <TellerDesk />;
  if (path === '/app/audit') return <AuditLedger />;
  if (path === '/app/customers') return <CustomerDirectory />;
  if (path === '/app/configuration') return <ManagementSettings />;
  if (['/app/overview', '/app'].includes(path)) return <ManagementOverview />;
  return <Navigate to={`${basePath}/app/overview`} replace />;
}
function roleName(role: Role) { return ({ customer: 'Personal banking', teller: 'Branch agent', loan_officer: 'Lending officer', admin: 'Manager' })[role]; }

function ToastHost() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let timer = 0;
    const show = (event: Event) => {
      setMessage((event as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(''), 5500);
    };
    window.addEventListener('app-toast', show);
    return () => { window.removeEventListener('app-toast', show); window.clearTimeout(timer); };
  }, []);
  return message ? <div className="toast-message" role="status">{message}<button onClick={() => setMessage('')} aria-label="Dismiss message"><X size={15} /></button></div> : null;
}
