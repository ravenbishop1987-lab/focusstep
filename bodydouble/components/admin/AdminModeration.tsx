'use client'

import { useState, useEffect } from 'react'
import {
  banUser,
  blockTaskShare,
  fetchModeratedTaskShares,
  fetchUserReports,
  resolveUserReport,
  unbanUser,
  unblockTaskShare,
} from './admin-api'

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

type Share = {
  share_code: string
  taskText: string
  status: string
  clickCount: number
  acceptedCount: number
  completedCount: number
  created_at: string | null
}

type Report = {
  id: string
  room_id: string | null
  reason: string
  details: string | null
  status: string
  review_notes: string | null
  created_at: string | null
  reporter: { id: string; name: string | null; email: string | null } | null
  reported: {
    id: string
    name: string | null
    email: string | null
    is_banned?: boolean | null
    banned_reason?: string | null
    banned_until?: string | null
  } | null
}

export default function AdminModeration() {
  const [shares, setShares] = useState<Share[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [shareData, reportData] = await Promise.all([fetchModeratedTaskShares(), fetchUserReports()])
      setShares(Array.isArray(shareData) ? shareData : [])
      setReports(Array.isArray(reportData) ? reportData : [])
      setError(null)
    } catch (e) {
      setShares([])
      setReports([])
      setError(e instanceof Error ? e.message : 'Failed to load moderation queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const moderate = async (shareCode: string, action: 'block' | 'unblock') => {
    setActing(`${action}-${shareCode}`)
    try {
      if (action === 'block') await blockTaskShare(shareCode)
      else await unblockTaskShare(shareCode)
      await load()
    } catch (e) { alert((e as Error).message) }
    setActing(null)
  }

  const reviewReport = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    setActing(`${status}-${reportId}`)
    try {
      await resolveUserReport(reportId, status)
      await load()
    } catch (e) {
      alert((e as Error).message)
    }
    setActing(null)
  }

  const handleBanUser = async (report: Report) => {
    if (!report.reported?.id) return
    const reason = window.prompt('Ban reason', report.reason || report.details || 'Moderation review')?.trim()
    if (!reason) return
    const durationInput = window.prompt('Ban duration in days (0 for indefinite)', '0') ?? '0'
    const durationDays = Number.parseInt(durationInput, 10)

    setActing(`ban-${report.id}`)
    try {
      await banUser(report.reported.id, reason, Number.isFinite(durationDays) ? durationDays : 0)
      await resolveUserReport(report.id, 'reviewed', `User banned. ${reason}`)
      await load()
    } catch (e) {
      alert((e as Error).message)
    }
    setActing(null)
  }

  const handleUnbanUser = async (report: Report) => {
    if (!report.reported?.id) return
    setActing(`unban-${report.id}`)
    try {
      await unbanUser(report.reported.id)
      await load()
    } catch (e) {
      alert((e as Error).message)
    }
    setActing(null)
  }

  if (loading) return <div className="a-loading">Loading moderation queues…</div>
  if (error) return <div className="a-error">Failed to load moderation queue: {error}</div>

  return (
    <div>
      <div className="a-section-header">
        <div>
          <h2 className="a-section-title">Moderation</h2>
          <p className="a-section-sub">Review reported users and public shared tasks</p>
        </div>
      </div>
      <div className="a-card a-table-card" style={{ marginBottom: 20 }}>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Reported user</th>
                <th>Reporter</th>
                <th>Reason</th>
                <th>Room</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && <tr><td colSpan={7} className="a-table-empty">No user reports found.</td></tr>}
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <div className="a-user-cell">
                      <div className="a-user-avatar">{(report.reported?.email || report.reported?.name || '?')[0]?.toUpperCase()}</div>
                      <div>
                        <div className="a-user-email">{report.reported?.name || report.reported?.email || 'Unknown user'}</div>
                        <div className="a-cell-muted">{report.reported?.email || 'No email'}</div>
                        {report.reported?.is_banned ? <div className="a-cell-muted" style={{ color: 'var(--danger, #b42318)' }}>Currently banned</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="a-cell-task">
                    {report.reporter?.name || report.reporter?.email || 'Unknown reporter'}
                    {report.details ? <div className="a-cell-muted" style={{ marginTop: 6 }}>{report.details}</div> : null}
                  </td>
                  <td>{report.reason}</td>
                  <td><code className="a-code-chip">{report.room_id || '—'}</code></td>
                  <td>
                    <span className={`a-badge ${report.status === 'dismissed' ? 'a-badge-free' : report.status === 'reviewed' ? 'a-badge-pro' : 'a-badge-life'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="a-cell-muted">{timeAgo(report.created_at)}</td>
                  <td>
                    <div className="a-actions">
                      <button className="a-btn-action a-btn-edit" disabled={!!acting} onClick={() => reviewReport(report.id, 'reviewed')}>
                        Review
                      </button>
                      <button className="a-btn-action a-btn-reset" disabled={!!acting} onClick={() => reviewReport(report.id, 'dismissed')}>
                        Dismiss
                      </button>
                      {report.reported?.is_banned ? (
                        <button className="a-btn-action a-btn-edit" disabled={!!acting} onClick={() => handleUnbanUser(report)}>
                          Unban
                        </button>
                      ) : (
                        <button className="a-btn-action a-btn-delete" disabled={!!acting} onClick={() => handleBanUser(report)}>
                          Ban user
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="a-card a-table-card">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Code</th><th>Task</th><th>Status</th><th>Clicks</th>
                <th>Accepted</th><th>Completed</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shares.length === 0 && <tr><td colSpan={8} className="a-table-empty">No shared tasks found.</td></tr>}
              {shares.map(share => (
                <tr key={share.share_code}>
                  <td><code className="a-code-chip">{share.share_code}</code></td>
                  <td className="a-cell-task">{share.taskText}</td>
                  <td>
                    <span className={`a-badge ${share.status === 'declined' ? 'a-badge-rejected' : 'a-badge-pro'}`}>
                      {share.status === 'declined' ? 'blocked' : share.status}
                    </span>
                  </td>
                  <td>{share.clickCount}</td>
                  <td>{share.acceptedCount}</td>
                  <td>{share.completedCount}</td>
                  <td className="a-cell-muted">{timeAgo(share.created_at)}</td>
                  <td>
                    {share.status === 'declined' ? (
                      <button className="a-btn-action a-btn-edit" disabled={!!acting} onClick={() => moderate(share.share_code, 'unblock')}>
                        Restore
                      </button>
                    ) : (
                      <button className="a-btn-action a-btn-delete" disabled={!!acting} onClick={() => moderate(share.share_code, 'block')}>
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
  )
}
