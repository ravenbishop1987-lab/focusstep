import { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import UserTable from './UserTable';
import AdminReferrals from './AdminReferrals';
import AdminReferralRewards from './AdminReferralRewards';
import AdminReferralSettings from './AdminReferralSettings';
import AdminModeration from './AdminModeration';
import AdminAuditLog from './AdminAuditLog';
import supabase from '../lib/supabase';
import './admin.css';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export default function AdminApp() {
  const [section, setSection] = useState('dashboard');
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('[admin] session user:', data.session?.user?.email, '| admin list:', ADMIN_EMAILS);
      setUser(data.session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) return <div className="a-shell"><div className="a-loading">Checking access…</div></div>;

  const isAdmin = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(user?.email?.toLowerCase());
  if (!user || !isAdmin) {
    return (
      <div className="a-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="a-card" style={{ maxWidth: 360, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Admin Access Required</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>Sign in with an admin account to continue.</p>
          <a href="/" style={{ color: '#3b82f6', fontSize: 14 }}>← Back to App</a>
        </div>
      </div>
    );
  }

  return (
    <div className="a-shell">
      <aside className="a-sidebar">
        <div className="a-sidebar-logo">
          <span className="a-sidebar-icon">◎</span>
          <span>FocusStep</span>
          <span className="a-sidebar-admin-badge">Admin</span>
        </div>

        <nav className="a-nav">
          <button
            className={`a-nav-item ${section === 'dashboard' ? 'a-nav-active' : ''}`}
            onClick={() => setSection('dashboard')}
          >
            <span className="a-nav-icon">📊</span>
            Dashboard
          </button>
          <button
            className={`a-nav-item ${section === 'users' ? 'a-nav-active' : ''}`}
            onClick={() => setSection('users')}
          >
            <span className="a-nav-icon">👥</span>
            Users
          </button>
          <button
            className={`a-nav-item ${section === 'referrals' ? 'a-nav-active' : ''}`}
            onClick={() => setSection('referrals')}
          >
            <span className="a-nav-icon">🔗</span>
            Referrals
          </button>
          <button
            className={`a-nav-item ${section === 'rewards' ? 'a-nav-active' : ''}`}
            onClick={() => setSection('rewards')}
          >
            <span className="a-nav-icon">🎁</span>
            Rewards
          </button>
          <button
            className={`a-nav-item ${section === 'reward-rules' ? 'a-nav-active' : ''}`}
            onClick={() => setSection('reward-rules')}
          >
            <span className="a-nav-icon">⚙️</span>
            Reward Rules
          </button>
          <button
            className={`a-nav-item ${section === 'moderation' ? 'a-nav-active' : ''}`}
            onClick={() => setSection('moderation')}
          >
            <span className="a-nav-icon">🛡️</span>
            Moderation
          </button>
          <button
            className={`a-nav-item ${section === 'audit' ? 'a-nav-active' : ''}`}
            onClick={() => setSection('audit')}
          >
            <span className="a-nav-icon">🧾</span>
            Audit Log
          </button>
        </nav>

        <div className="a-sidebar-footer">
          <a href="/" className="a-back-link">← Back to App</a>
        </div>
      </aside>

      <div className="a-content">
        <header className="a-topbar">
          <div>
            <h1 className="a-topbar-title">
              {{ dashboard: 'Dashboard', users: 'User Management', referrals: 'Referrals', rewards: 'Referral Rewards', 'reward-rules': 'Reward Rules', moderation: 'Moderation', audit: 'Audit Log' }[section] || 'Dashboard'}
            </h1>
            <p className="a-topbar-sub">
              {{ dashboard: 'Overview of all key metrics', users: 'Manage and monitor your users', referrals: 'Track referral links and conversions', rewards: 'Issue, edit, and reverse individual rewards', 'reward-rules': 'Define reward logic per referrer plan', moderation: 'Review public shared tasks', audit: 'See who changed what and when' }[section] || ''}
            </p>
          </div>
          <div className="a-topbar-time">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <main className="a-main">
          {section === 'dashboard'    && <Dashboard />}
          {section === 'users'        && <UserTable />}
          {section === 'referrals'    && <AdminReferrals />}
          {section === 'rewards'      && <AdminReferralRewards />}
          {section === 'reward-rules' && <AdminReferralSettings />}
          {section === 'moderation'   && <AdminModeration />}
          {section === 'audit'        && <AdminAuditLog />}
        </main>
      </div>
    </div>
  );
}
