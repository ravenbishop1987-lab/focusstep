import { useState, useEffect } from 'react';
import { fetchUsers, updateUser, deleteUser, fetchUserDetail } from './api';
import SearchBar from './SearchBar';

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

const BADGE = { free: 'a-badge-free', pro: 'a-badge-pro', lifetime: 'a-badge-life', monthly: 'a-badge-pro' };

function planLabel(u) {
  if (u.plan === 'lifetime') return '★ Lifetime';
  if (u.is_pro) return 'Pro';
  return 'Free';
}

function planKey(u) {
  if (u.plan === 'lifetime') return 'lifetime';
  if (u.is_pro) return 'pro';
  return 'free';
}

export default function UserTable() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [confirmEmail, setConfirmEmail] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchUsers()
      .then(data => setUsers(data.map(u => ({ ...u, status: isActive(u) ? 'active' : 'inactive' }))))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function isActive(u) {
    if (!u.updated_at) return false;
    return (Date.now() - new Date(u.updated_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
  }

  const filtered = users.filter(u => {
    const q = query.toLowerCase();
    const matchQ = !q || u.email?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || u.status === statusFilter;
    const matchM = memberFilter === 'all' || planKey(u) === memberFilter;
    return matchQ && matchS && matchM;
  });

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await updateUser(editUser.email, { is_pro: editUser.is_pro, plan: editUser.plan });
      setUsers(prev => prev.map(u => u.email === editUser.email ? { ...u, ...editUser } : u));
      setEditUser(null);
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const handleConfirmed = async () => {
    try {
      if (confirmAction === 'delete') {
        await deleteUser(confirmEmail);
        setUsers(prev => prev.filter(u => u.email !== confirmEmail));
      }
    } catch (e) { alert('Action failed: ' + e.message); }
    setConfirmEmail(null);
    setConfirmAction(null);
  };

  const openDetail = async (email) => {
    setDetailLoading(true);
    setDetail({ email, loading: true });
    try {
      const data = await fetchUserDetail(email);
      setDetail(data);
    } catch (e) {
      alert(`Could not load detail: ${e.message}`);
      setDetail(null);
    }
    setDetailLoading(false);
  };

  if (loading) return <div className="a-loading">Loading users…</div>;
  if (error) return <div className="a-error">Failed to load users: {error}</div>;

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
                <th>Email</th>
                <th>Plan</th>
                <th>Last Active</th>
                <th>Status</th>
                <th>Spent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="a-table-empty">No users match your filters.</td></tr>
              )}
              {filtered.map(user => (
                <tr key={user.email} className={user.status === 'inactive' ? 'a-row-inactive' : ''}>
                  <td>
                    <div className="a-user-cell">
                      <div className="a-user-avatar">{user.email?.[0]?.toUpperCase()}</div>
                      <div className="a-user-email">{user.email}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`a-badge ${BADGE[planKey(user)]}`}>{planLabel(user)}</span>
                  </td>
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
                      <button className="a-btn-action a-btn-delete" onClick={() => { setConfirmEmail(user.email); setConfirmAction('delete'); }}>Delete</button>
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
                <input className="a-input" value={editUser.email} disabled style={{ opacity: 0.6 }} />
              </label>
              <label className="a-field">
                <span>Plan</span>
                <select
                  className="a-input"
                  value={editUser.plan || (editUser.is_pro ? 'monthly' : 'free')}
                  onChange={e => setEditUser(p => ({ ...p, plan: e.target.value, is_pro: e.target.value !== 'free' }))}
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

      {/* Confirm delete */}
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
              <button className="a-btn-danger" onClick={handleConfirmed}>Delete</button>
            </div>
          </div>
        </div>
      )}

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
              ) : (
                <>
                  <div className="a-detail-grid">
                    <div className="a-detail-card">
                      <div className="a-detail-title">Customer</div>
                      {[
                        ['Email', detail.customer?.email],
                        ['Plan', detail.customer?.plan || 'free'],
                        ['Pro', detail.customer?.is_pro ? 'Yes' : 'No'],
                        ['Expires', detail.customer?.pro_expires_at ? new Date(detail.customer.pro_expires_at).toLocaleString() : '—'],
                        ['Updated', detail.customer?.updated_at ? new Date(detail.customer.updated_at).toLocaleString() : '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="a-detail-row">
                          <span className="a-detail-label">{label}</span>
                          <span className="a-detail-value">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="a-detail-card">
                      <div className="a-detail-title">Summary</div>
                      {[
                        ['Payments', fmt(detail.summary?.totalPayments)],
                        ['Referral revenue', fmt(detail.summary?.totalReferralRevenue)],
                        ['Rewards issued', detail.summary?.totalRewardsIssued ?? 0],
                        ['Payouts paid', fmt(detail.summary?.totalPayoutsPaid)],
                        ['Referrals sent', detail.summary?.referralsSent ?? 0],
                        ['Referrals received', detail.summary?.referralsReceived ?? 0],
                      ].map(([label, value]) => (
                        <div key={label} className="a-detail-row">
                          <span className="a-detail-label">{label}</span>
                          <span className="a-detail-value">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="a-detail-section">
                    <div className="a-detail-title">Recent Payments</div>
                    <div className="a-mini-list">
                      {(detail.payments || []).length === 0 && <div className="a-table-empty">No payments recorded.</div>}
                      {(detail.payments || []).map((payment) => (
                        <div key={payment.id} className="a-mini-row">
                          <span>{payment.plan_type} · {fmt(payment.amount)}</span>
                          <span>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="a-detail-grid">
                    <div className="a-detail-section">
                      <div className="a-detail-title">Referrals Sent</div>
                      <div className="a-mini-list">
                        {(detail.referralsSent || []).length === 0 && <div className="a-table-empty">No sent referrals.</div>}
                        {(detail.referralsSent || []).map((ref) => (
                          <div key={ref.id} className="a-mini-row">
                            <span>{ref.referred_email || ref.referral_code}</span>
                            <span>{ref.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="a-detail-section">
                      <div className="a-detail-title">Referral Rewards</div>
                      <div className="a-mini-list">
                        {(detail.rewards || []).length === 0 && <div className="a-table-empty">No rewards.</div>}
                        {(detail.rewards || []).map((reward) => (
                          <div key={reward.id} className="a-mini-row">
                            <span>{reward.reward_value} {reward.reward_type}</span>
                            <span>{reward.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="a-detail-section">
                    <div className="a-detail-title">Referral Activity</div>
                    <div className="a-mini-list">
                      {(detail.referralEvents || [])
                        .sort((a, b) => new Date((b.created_at || 0)).getTime() - new Date((a.created_at || 0)).getTime())
                        .slice(0, 10)
                        .map((item, index) => (
                          <div key={item.id || `${item.event_type}-${index}`} className="a-mini-row">
                            <span>{item.event_type}</span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="a-modal-footer">
              <button className="a-btn-secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
