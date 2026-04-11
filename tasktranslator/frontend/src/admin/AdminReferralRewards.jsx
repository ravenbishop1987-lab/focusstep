import { useState, useEffect } from 'react';
import { authFetch } from '../lib/api';

const BASE = import.meta.env.VITE_API_URL || '';

const STATUS_BADGE = {
  pending:        'a-badge-free',
  ready_to_issue: 'a-badge-pro',
  issued:         'a-badge-life',
  reversed:       'a-badge-rejected',
  rejected:       'a-badge-rejected',
  none:           'a-badge-free',
};

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminReferralRewards() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [acting, setActing] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = () => {
    setLoading(true);
    authFetch(`${BASE}/admin/referral-rewards`).then(r => r.json())
      .then(d => setRewards(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = (r) => {
    setSelected(r);
    setEditForm({ reward_type: r.reward_type, reward_value: r.reward_value, notes: r.notes || '' });
  };

  const saveEdit = async () => {
    if (!selected) return;
    setActing('save');
    try {
      await authFetch(`${BASE}/admin/referral-rewards/${selected.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      load();
      setSelected(s => ({ ...s, ...editForm }));
    } catch {}
    setActing(null);
  };

  const issue = async () => {
    if (!selected) return;
    if (!window.confirm(`Issue ${selected.reward_value} Pro days to ${selected.reward_recipient_email}?`)) return;
    setActing('issue');
    try {
      const res = await authFetch(`${BASE}/admin/referral-rewards/${selected.id}/issue`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed'); return; }
      load();
      setSelected(null);
    } catch { alert('Failed'); }
    setActing(null);
  };

  const reverse = async () => {
    if (!selected) return;
    if (!window.confirm('Reverse this reward? This will attempt to reduce the recipient\'s Pro time.')) return;
    setActing('reverse');
    try {
      await authFetch(`${BASE}/admin/referral-rewards/${selected.id}/reverse`, { method: 'POST' });
      load();
      setSelected(null);
    } catch { alert('Failed'); }
    setActing(null);
  };

  const filtered = rewards.filter(r => {
    const q = query.toLowerCase();
    const ref = r.referrals || {};
    const matchQ = !q
      || r.reward_recipient_email?.toLowerCase().includes(q)
      || ref.referrer_email?.toLowerCase().includes(q)
      || ref.referred_email?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || r.status === statusFilter;
    return matchQ && matchS;
  });

  const counts = {
    ready: rewards.filter(r => r.status === 'ready_to_issue').length,
    pending: rewards.filter(r => r.status === 'pending').length,
  };

  if (loading) return <div className="a-loading">Loading rewards…</div>;

  return (
    <div>
      <div className="a-section-header">
        <div>
          <h2 className="a-section-title">Referral Rewards</h2>
          <p className="a-section-sub">{filtered.length} of {rewards.length} rewards</p>
        </div>
        {counts.ready > 0 && (
          <div className="a-badge a-badge-pro" style={{ fontSize: 13, padding: '6px 12px' }}>
            {counts.ready} ready to issue
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="a-searchbar">
        <div className="a-search-input-wrap">
          <span className="a-search-icon">🔍</span>
          <input className="a-search-input" placeholder="Search by email…" value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button className="a-search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>
        <div className="a-filters">
          <select className="a-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="ready_to_issue">Ready to Issue</option>
            <option value="issued">Issued</option>
            <option value="reversed">Reversed</option>
            <option value="rejected">Rejected</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="a-card a-table-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Referrer</th>
                <th>Referred user</th>
                <th>Recipient</th>
                <th>Plan bought</th>
                <th>Reward</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="a-table-empty">No rewards found.</td></tr>}
              {filtered.map(r => {
                const ref = r.referrals || {};
                return (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                    <td className="a-user-email">{ref.referrer_email || '—'}</td>
                    <td className="a-user-email">{ref.referred_email || '—'}</td>
                    <td>
                      <div>
                        <div className="a-user-email">{r.reward_recipient_email}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          {r.reward_recipient_type === 'referrer' ? 'Referrer' : 'Referred user'}
                        </div>
                      </div>
                    </td>
                    <td className="a-cell-muted">{ref.purchased_plan || '—'}</td>
                    <td>
                      {r.reward_type === 'none' ? '—'
                        : <span className="a-badge a-badge-pro">{r.reward_value}d Pro</span>}
                    </td>
                    <td>
                      <span className={`a-badge ${STATUS_BADGE[r.status] || 'a-badge-free'}`}>
                        {r.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="a-cell-muted">{timeAgo(r.issued_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="a-actions">
                        {r.status === 'ready_to_issue' && (
                          <button className="a-btn-action a-btn-edit" onClick={() => { openDetail(r); }}>
                            Issue
                          </button>
                        )}
                        {r.status === 'issued' && (
                          <button className="a-btn-action a-btn-reset" onClick={() => { openDetail(r); }}>
                            Reverse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && editForm && (
        <div className="a-modal-overlay" onClick={() => setSelected(null)}>
          <div className="a-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="a-modal-header">
              <h3>Reward Detail</h3>
              <button className="a-modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="a-modal-body">

              {/* Role clarity block */}
              <div className="rr-roles">
                <div className="rr-role">
                  <div className="rr-role-label">Referrer</div>
                  <div className="rr-role-value">{selected.referrals?.referrer_email || '—'}</div>
                </div>
                <div className="rr-role-arrow">→</div>
                <div className="rr-role">
                  <div className="rr-role-label">Referred user</div>
                  <div className="rr-role-value">{selected.referrals?.referred_email || '—'}</div>
                </div>
              </div>

              <div className="rr-recipient-block">
                <span className="rr-recipient-label">Reward recipient</span>
                <span className="rr-recipient-email">{selected.reward_recipient_email}</span>
                <span className="rr-recipient-type">
                  ({selected.reward_recipient_type === 'referrer' ? 'the referrer' : 'the referred user'})
                </span>
              </div>

              {/* Info rows */}
              {[
                ['Status', <span className={`a-badge ${STATUS_BADGE[selected.status] || 'a-badge-free'}`}>{selected.status?.replace(/_/g, ' ')}</span>],
                ['Plan bought', selected.referrals?.purchased_plan || '—'],
                ['Issued at', selected.issued_at ? new Date(selected.issued_at).toLocaleString() : '—'],
                ['Issued by', selected.issued_by_admin_email || '—'],
                ['Reversed at', selected.reversed_at ? new Date(selected.reversed_at).toLocaleString() : '—'],
                ['Reversed by', selected.reversed_by_admin_email || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: '#0f172a' }}>{value}</span>
                </div>
              ))}

              {/* Editable fields */}
              {['pending','ready_to_issue'].includes(selected.status) && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Override reward before issuing
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="a-field">
                      <span>Reward type</span>
                      <select className="a-input" value={editForm.reward_type} onChange={e => setEditForm(f => ({ ...f, reward_type: e.target.value }))}>
                        <option value="pro_days">Pro days</option>
                        <option value="none">No reward</option>
                      </select>
                    </div>
                    <div className="a-field">
                      <span>Days</span>
                      <input className="a-input" type="number" min={0} max={365}
                        disabled={editForm.reward_type === 'none'}
                        value={editForm.reward_value}
                        onChange={e => setEditForm(f => ({ ...f, reward_value: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="a-field" style={{ marginTop: 12 }}>
                <span>Internal notes</span>
                <textarea className="a-input" rows={3} style={{ resize: 'vertical' }}
                  placeholder="Optional notes for this reward…"
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

            </div>
            <div className="a-modal-footer" style={{ gap: 8 }}>
              <button className="a-btn-secondary" onClick={() => setSelected(null)}>Close</button>
              {['pending','ready_to_issue'].includes(selected.status) && (
                <button className="a-btn-secondary" onClick={saveEdit} disabled={!!acting}>
                  {acting === 'save' ? 'Saving…' : 'Save changes'}
                </button>
              )}
              {['pending','ready_to_issue'].includes(selected.status) && selected.reward_type !== 'none' && editForm.reward_type !== 'none' && (
                <button className="a-btn-primary" onClick={issue} disabled={!!acting}>
                  {acting === 'issue' ? 'Issuing…' : `Issue ${editForm.reward_value}d Pro`}
                </button>
              )}
              {selected.status === 'issued' && (
                <button className="a-btn-danger" onClick={reverse} disabled={!!acting}>
                  {acting === 'reverse' ? 'Reversing…' : 'Reverse reward'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
