'use client'

import { useState, useEffect } from 'react'
import SearchBar from './SearchBar'
import { fetchUsers, updateUser, deleteUser, fetchUserDetail } from './admin-api'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const BADGE: Record<string, string> = { free: 'a-badge-free', pro: 'a-badge-pro', lifetime: 'a-badge-life', monthly: 'a-badge-pro' }

function planLabel(u: User) {
  if (u.plan === 'lifetime') return '★ Lifetime'
  if (u.is_pro) return 'Pro'
  return 'Free'
}

function planKey(u: User) {
  if (u.plan === 'lifetime') return 'lifetime'
  if (u.is_pro) return 'pro'
  return 'free'
}

function isActive(u: User) {
  if (!u.updated_at) return false
  return (Date.now() - new Date(u.updated_at).getTime()) < 7 * 24 * 60 * 60 * 1000
}

type User = {
  email: string
  is_pro: boolean
  plan: string
  updated_at: string | null
  status: 'active' | 'inactive'
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState('all')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
      .then((data: User[]) => setUsers(data.map(u => ({ ...u, status: isActive(u) ? 'active' : 'inactive' }))))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u => {
    const q = query.toLowerCase()
    const matchQ = !q || u.email?.toLowerCase().includes(q)
    const matchS = statusFilter === 'all' || u.status === statusFilter
    const matchM = memberFilter === 'all' || planKey(u) === memberFilter
    return matchQ && matchS && matchM
  })

  const handleSaveEdit = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      await updateUser(editUser.email, { is_pro: editUser.is_pro, plan: editUser.plan })
      setUsers(prev => prev.map(u => u.email === editUser.email ? { ...u, ...editUser } : u))
      setEditUser(null)
    } catch (e) { alert('Save failed: ' + (e as Error).message) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirmEmail) return
    try {
      await deleteUser(confirmEmail)
      setUsers(prev => prev.filter(u => u.email !== confirmEmail))
    } catch (e) { alert('Action failed: ' + (e as Error).message) }
    setConfirmEmail(null)
  }

  const openDetail = async (email: string) => {
    setDetailLoading(true)
    setDetail({ email, loading: true })
    try {
      const data = await fetchUserDetail(email)
      setDetail(data)
    } catch (e) {
      alert(`Could not load detail: ${(e as Error).message}`)
      setDetail(null)
    }
    setDetailLoading(false)
  }

  if (loading) return <div className="a-loading">Loading users…</div>
  if (error) return <div className="a-error">Failed to load users: {error}</div>

  return (
    <div>
      <div className="a-section-header">
        <div>
          <h2 className="a-section-title">Users</h2>
          <p className="a-section-sub">{filtered.length} of {users.length} users</p>
        </div>
      </div>

      <SearchBar
        query={query} setQuery={setQuery}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        memberFilter={memberFilter} setMemberFilter={setMemberFilter}
      />

      <div className="a-card a-table-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Email</th><th>Plan</th><th>Last Active</th><th>Status</th><th>Spent</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="a-table-empty">No users match your filters.</td></tr>}
              {filtered.map(user => (
                <tr key={user.email} className={user.status === 'inactive' ? 'a-row-inactive' : ''}>
                  <td>
                    <div className="a-user-cell">
                      <div className="a-user-avatar">{user.email?.[0]?.toUpperCase()}</div>
                      <div className="a-user-email">{user.email}</div>
                    </div>
                  </td>
                  <td><span className={`a-badge ${BADGE[planKey(user)]}`}>{planLabel(user)}</span></td>
                  <td className="a-cell-muted">{timeAgo(user.updated_at)}</td>
                  <td>
                    <span className={`a-status-toggle ${user.status === 'active' ? 'a-status-active' : 'a-status-inactive'}`}>
                      {user.status === 'active' ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="a-cell-spent">{fmt(user.plan === 'lifetime' ? 49 : user.is_pro ? 12 : 0)}</td>
                  <td>
                    <div className="a-actions">
                      <button className="a-btn-action a-btn-reset" onClick={() => openDetail(user.email)}>View</button>
                      <button className="a-btn-action a-btn-edit" onClick={() => setEditUser({ ...user })}>Edit</button>
                      <button className="a-btn-action a-btn-delete" onClick={() => setConfirmEmail(user.email)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="a-modal-overlay" onClick={() => setEditUser(null)}>
          <div className="a-modal" onClick={e => e.stopPropagation()}>
            <div className="a-modal-header">
              <h3>Edit User</h3>
              <button className="a-modal-close" onClick={() => setEditUser(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              <label className="a-field">
                <span>Email</span>
                <input className="a-input" value={editUser.email} disabled style={{ opacity: 0.6 }} readOnly />
              </label>
              <label className="a-field">
                <span>Plan</span>
                <select
                  className="a-input"
                  value={editUser.plan || (editUser.is_pro ? 'monthly' : 'free')}
                  onChange={e => setEditUser(p => p ? { ...p, plan: e.target.value, is_pro: e.target.value !== 'free' } : p)}
                >
                  <option value="free">Free</option>
                  <option value="monthly">Pro (Monthly)</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </label>
            </div>
            <div className="a-modal-footer">
              <button className="a-btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="a-btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmEmail && (
        <div className="a-modal-overlay" onClick={() => setConfirmEmail(null)}>
          <div className="a-modal a-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="a-modal-header">
              <h3>Delete User</h3>
              <button className="a-modal-close" onClick={() => setConfirmEmail(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              <p className="a-confirm-text">This will permanently delete <strong>{confirmEmail}</strong> and all their data.</p>
            </div>
            <div className="a-modal-footer">
              <button className="a-btn-secondary" onClick={() => setConfirmEmail(null)}>Cancel</button>
              <button className="a-btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="a-modal-overlay" onClick={() => setDetail(null)}>
          <div className="a-modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <div className="a-modal-header">
              <h3>Customer Detail</h3>
              <button className="a-modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              {detailLoading || detail.loading ? (
                <div className="a-loading-sm">Loading customer detail…</div>
              ) : (() => {
                const customer = detail.customer as Record<string, unknown>
                const summary = detail.summary as Record<string, unknown>
                return (
                  <>
                    <div className="a-detail-grid">
                      <div className="a-detail-card">
                        <div className="a-detail-title">Customer</div>
                        {([
                          ['Email', customer?.email],
                          ['Plan', customer?.plan || 'free'],
                          ['Pro', customer?.is_pro ? 'Yes' : 'No'],
                          ['Expires', customer?.pro_expires_at ? new Date(customer.pro_expires_at as string).toLocaleString() : '—'],
                          ['Updated', customer?.updated_at ? new Date(customer.updated_at as string).toLocaleString() : '—'],
                        ] as [string, unknown][]).map(([label, value]) => (
                          <div key={label} className="a-detail-row">
                            <span className="a-detail-label">{label}</span>
                            <span className="a-detail-value">{String(value ?? '—')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="a-detail-card">
                        <div className="a-detail-title">Summary</div>
                        {([
                          ['Payments', fmt(summary?.totalPayments as number)],
                          ['Referral revenue', fmt(summary?.totalReferralRevenue as number)],
                          ['Rewards issued', String(summary?.totalRewardsIssued ?? 0)],
                          ['Payouts paid', fmt(summary?.totalPayoutsPaid as number)],
                          ['Referrals sent', String(summary?.referralsSent ?? 0)],
                          ['Referrals received', String(summary?.referralsReceived ?? 0)],
                        ] as [string, string][]).map(([label, value]) => (
                          <div key={label} className="a-detail-row">
                            <span className="a-detail-label">{label}</span>
                            <span className="a-detail-value">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="a-detail-section" style={{ marginTop: 16 }}>
                      <div className="a-detail-title">Recent Payments</div>
                      <div className="a-mini-list">
                        {!(detail.payments as unknown[])?.length && <div className="a-table-empty">No payments recorded.</div>}
                        {(detail.payments as Record<string, unknown>[])?.map((p) => (
                          <div key={p.id as string} className="a-mini-row">
                            <span>{p.plan_type as string} · {fmt(p.amount as number)}</span>
                            <span>{p.created_at ? new Date(p.created_at as string).toLocaleDateString() : '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="a-modal-footer">
              <button className="a-btn-secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
