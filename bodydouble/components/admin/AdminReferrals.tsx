'use client'

import { useState, useEffect } from 'react'
import { fetchReferrals, fetchReferralStats, actOnReferral } from './admin-api'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

const STATUS_BADGE: Record<string, string> = {
  clicked: 'a-badge-free', signed_up: 'a-badge-pro',
  converted: 'a-badge-life', rewarded: 'a-badge-rewarded', rejected: 'a-badge-rejected',
}

type Referral = {
  id: string
  referral_code: string
  referrer_email: string
  referred_email: string
  status: string
  clicked_at: string | null
  signed_up_at: string | null
  converted_at: string | null
  purchased_plan: string | null
  purchase_amount: number | null
  reward_type: string | null
  reward_value: number | null
  reward_issued_at: string | null
  reward_reversed_at: string | null
}

export default function AdminReferrals() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [selected, setSelected] = useState<Referral | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = () =>
    Promise.allSettled([fetchReferrals(), fetchReferralStats()])
      .then(([refsResult, statsResult]) => {
        if (refsResult.status === 'fulfilled') {
          setReferrals(Array.isArray(refsResult.value) ? refsResult.value : [])
          setError(null)
        } else {
          setReferrals([])
          setError(refsResult.reason instanceof Error ? refsResult.reason.message : 'Failed to load referrals.')
        }

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value as Record<string, unknown>)
          setStatsError(null)
        } else {
          setStats(null)
          setStatsError(statsResult.reason instanceof Error ? statsResult.reason.message : 'Failed to load referral stats.')
        }
      })
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const act = async (id: string, action: string) => {
    setActing(id + action)
    try {
      await actOnReferral(id, action)
      const updated: Referral[] = await fetchReferrals()
      setReferrals(updated)
      setSelected(updated.find(r => r.id === id) || null)
    } catch { alert('Action failed') }
    setActing(null)
  }

  const filtered = referrals.filter(r => {
    const q = query.toLowerCase()
    const matchQ = !q || r.referrer_email?.includes(q) || r.referred_email?.includes(q) || r.referral_code?.toLowerCase().includes(q)
    const matchS = statusFilter === 'all' || r.status === statusFilter
    const matchP = planFilter === 'all' || r.purchased_plan === planFilter
    return matchQ && matchS && matchP
  })

  if (loading) return <div className="a-loading">Loading referrals…</div>
  if (error) return <div className="a-error">Failed to load referrals: {error}</div>

  return (
    <div>
      <div className="a-section-header">
        <div>
          <h2 className="a-section-title">Referrals</h2>
          <p className="a-section-sub">{filtered.length} of {referrals.length} records</p>
        </div>
      </div>

      {statsError && (
        <div className="a-error" style={{ marginBottom: 20 }}>
          Referral stats unavailable: {statsError}
        </div>
      )}

      {stats && (
        <div className="a-stats-grid" style={{ marginBottom: 20 }}>
          <div className="a-card a-stat-card"><div className="a-stat-icon">🔗</div><div className="a-stat-body"><div className="a-stat-value">{stats.clicks as number}</div><div className="a-stat-label">Total Clicks</div></div></div>
          <div className="a-card a-stat-card"><div className="a-stat-icon">✍️</div><div className="a-stat-body"><div className="a-stat-value">{stats.signups as number}</div><div className="a-stat-label">Signups</div></div></div>
          <div className="a-card a-stat-card a-stat-accent"><div className="a-stat-icon">✅</div><div className="a-stat-body"><div className="a-stat-value">{stats.conversions as number}</div><div className="a-stat-label">Conversions</div><div className="a-stat-sub">{stats.conversionRate as number}% rate</div></div></div>
          <div className="a-card a-stat-card"><div className="a-stat-icon">🎁</div><div className="a-stat-body"><div className="a-stat-value">{stats.rewards as number}</div><div className="a-stat-label">Rewards Issued</div><div className="a-stat-sub">{stats.totalDays as number} Pro days granted</div></div></div>
          <div className="a-card a-stat-card a-stat-accent"><div className="a-stat-icon">💰</div><div className="a-stat-body"><div className="a-stat-value">{fmt(stats.totalRevenue as number)}</div><div className="a-stat-label">Referral Revenue</div><div className="a-stat-sub">{fmt(stats.monthRevenue as number)} this month</div></div></div>
        </div>
      )}

      <div className="a-searchbar">
        <div className="a-search-input-wrap">
          <span className="a-search-icon">🔍</span>
          <input className="a-search-input" placeholder="Search email or code…" value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button className="a-search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>
        <div className="a-filters">
          <select className="a-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="clicked">Clicked</option>
            <option value="signed_up">Signed Up</option>
            <option value="converted">Converted</option>
            <option value="rewarded">Rewarded</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="a-filter-select" value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
            <option value="all">All Plans</option>
            <option value="monthly">Pro Monthly</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </div>
      </div>

      <div className="a-card a-table-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Referrer</th><th>Referred</th><th>Code</th><th>Status</th>
                <th>Clicked</th><th>Converted</th><th>Plan</th><th>Amount</th><th>Reward</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={10} className="a-table-empty">No referrals found.</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                  <td className="a-user-email">{r.referrer_email || '—'}</td>
                  <td className="a-user-email">{r.referred_email || '—'}</td>
                  <td><code className="a-code-chip">{r.referral_code}</code></td>
                  <td><span className={`a-badge ${STATUS_BADGE[r.status] || 'a-badge-free'}`}>{r.status?.replace('_', ' ')}</span></td>
                  <td className="a-cell-muted">{timeAgo(r.clicked_at)}</td>
                  <td className="a-cell-muted">{timeAgo(r.converted_at)}</td>
                  <td className="a-cell-muted">{r.purchased_plan || '—'}</td>
                  <td>{r.purchase_amount ? fmt(r.purchase_amount) : '—'}</td>
                  <td>{r.reward_value ? `${r.reward_value}d Pro` : '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="a-actions">
                      {!['rewarded', 'rejected'].includes(r.status) && <button className="a-btn-action a-btn-edit" disabled={!!acting} onClick={() => act(r.id, 'approve')}>Approve</button>}
                      {r.status === 'converted' && <button className="a-btn-action a-btn-edit" disabled={!!acting} onClick={() => act(r.id, 'reward')}>Reward</button>}
                      {r.status === 'rewarded' && <button className="a-btn-action a-btn-reset" disabled={!!acting} onClick={() => act(r.id, 'reverse')}>Reverse</button>}
                      {r.status !== 'rejected' && <button className="a-btn-action a-btn-delete" disabled={!!acting} onClick={() => act(r.id, 'reject')}>Reject</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="a-modal-overlay" onClick={() => setSelected(null)}>
          <div className="a-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="a-modal-header">
              <h3>Referral Detail</h3>
              <button className="a-modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              {([
                ['Referral ID', selected.id],
                ['Code', selected.referral_code],
                ['Status', selected.status],
                ['Referrer', selected.referrer_email],
                ['Referred', selected.referred_email || '—'],
                ['Clicked At', selected.clicked_at ? new Date(selected.clicked_at).toLocaleString() : '—'],
                ['Signed Up At', selected.signed_up_at ? new Date(selected.signed_up_at).toLocaleString() : '—'],
                ['Converted At', selected.converted_at ? new Date(selected.converted_at).toLocaleString() : '—'],
                ['Purchased Plan', selected.purchased_plan || '—'],
                ['Purchase Amount', selected.purchase_amount ? fmt(selected.purchase_amount) : '—'],
                ['Reward Type', selected.reward_type || '—'],
                ['Reward Value', selected.reward_value ? `${selected.reward_value} days` : '—'],
                ['Reward Issued At', selected.reward_issued_at ? new Date(selected.reward_issued_at).toLocaleString() : '—'],
                ['Reward Reversed At', selected.reward_reversed_at ? new Date(selected.reward_reversed_at).toLocaleString() : '—'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: '#0f172a' }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="a-modal-footer">
              <button className="a-btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
