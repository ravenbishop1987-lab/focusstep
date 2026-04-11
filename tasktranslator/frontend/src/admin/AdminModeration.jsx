import { useEffect, useState } from 'react';
import {
  fetchModeratedTaskShares,
  blockTaskShare,
  unblockTaskShare,
} from './api';

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminModeration() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const shareData = await fetchModeratedTaskShares();
      setShares(Array.isArray(shareData) ? shareData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const moderateShare = async (shareCode, action) => {
    setActing(`${action}-${shareCode}`);
    try {
      if (action === 'block') await blockTaskShare(shareCode);
      else await unblockTaskShare(shareCode);
      await load();
    } catch (e) {
      alert(e.message);
    }
    setActing(null);
  };

  if (loading) return <div className="a-loading">Loading moderation queues…</div>;

  return (
    <div>
      <div className="a-section-header">
        <div>
          <h2 className="a-section-title">Moderation</h2>
          <p className="a-section-sub">Review public shared tasks</p>
        </div>
      </div>

      <div className="a-card a-table-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Task</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Accepted</th>
                <th>Completed</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.length === 0 && <tr><td colSpan={8} className="a-table-empty">No shared tasks found.</td></tr>}
              {shares.map((share) => (
                <tr key={share.share_code}>
                  <td><code className="a-code-chip">{share.share_code}</code></td>
                  <td className="a-cell-task">{share.taskText}</td>
                  <td><span className={`a-badge ${share.status === 'declined' ? 'a-badge-rejected' : 'a-badge-pro'}`}>{share.status === 'declined' ? 'blocked' : share.status}</span></td>
                  <td>{share.clickCount}</td>
                  <td>{share.acceptedCount}</td>
                  <td>{share.completedCount}</td>
                  <td className="a-cell-muted">{timeAgo(share.created_at)}</td>
                  <td>
                    {share.status === 'declined' ? (
                      <button className="a-btn-action a-btn-edit" disabled={!!acting} onClick={() => moderateShare(share.share_code, 'unblock')}>
                        Restore
                      </button>
                    ) : (
                      <button className="a-btn-action a-btn-delete" disabled={!!acting} onClick={() => moderateShare(share.share_code, 'block')}>
                        Block
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
