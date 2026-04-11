'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin/dashboard',     icon: '📊', label: 'Dashboard' },
  { href: '/admin/users',         icon: '👥', label: 'Users' },
  { href: '/admin/referrals',     icon: '🔗', label: 'Referrals' },
  { href: '/admin/rewards',       icon: '🎁', label: 'Rewards' },
  { href: '/admin/reward-rules',  icon: '⚙️', label: 'Reward Rules' },
  { href: '/admin/moderation',    icon: '🛡️', label: 'Moderation' },
  { href: '/admin/audit',         icon: '🧾', label: 'Audit Log' },
]

const TITLES: Record<string, { title: string; sub: string }> = {
  '/admin/dashboard':    { title: 'Dashboard',        sub: 'Overview of all key metrics' },
  '/admin/users':        { title: 'User Management',  sub: 'Manage and monitor your users' },
  '/admin/referrals':    { title: 'Referrals',         sub: 'Track referral links and conversions' },
  '/admin/rewards':      { title: 'Referral Rewards',  sub: 'Issue, edit, and reverse individual rewards' },
  '/admin/reward-rules': { title: 'Reward Rules',      sub: 'Define reward logic per referrer plan' },
  '/admin/moderation':   { title: 'Moderation',        sub: 'Review public shared tasks' },
  '/admin/audit':        { title: 'Audit Log',          sub: 'See who changed what and when' },
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const meta = TITLES[pathname] ?? { title: 'Admin', sub: '' }

  return (
    <div className="a-shell">
      <aside className="a-sidebar">
        <div className="a-sidebar-logo">
          <span className="a-sidebar-icon">◎</span>
          <span>FocusStep</span>
          <span className="a-sidebar-admin-badge">Admin</span>
        </div>

        <nav className="a-nav">
          {NAV.map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`a-nav-item${pathname === href ? ' a-nav-active' : ''}`}
            >
              <span className="a-nav-icon">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="a-sidebar-footer">
          <Link href="/dashboard" className="a-back-link">← Back to App</Link>
        </div>
      </aside>

      <div className="a-content">
        <header className="a-topbar">
          <div>
            <h1 className="a-topbar-title">{meta.title}</h1>
            {meta.sub && <p className="a-topbar-sub">{meta.sub}</p>}
          </div>
          <div className="a-topbar-time">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <main className="a-main">{children}</main>
      </div>
    </div>
  )
}
