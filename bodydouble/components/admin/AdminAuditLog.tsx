'use client'

import { useState, useEffect } from 'react'
import { fetchAuditLog } from './admin-api'

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

type Entry = {
  id: string
  action: string
  summary?: string
  admin_email?: string
  entity_type?: string
  target_email?: string
  entity_id?: string
  created_at: string
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAuditLog()
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="a-loading">Loading audit log…</div>
  if (error) return <div className="a-error">Failed to load audit log: {error}</div>

  return (
    <div>
      <div className="a-section-header">
        <div>
          <h2 className="a-section-title">Audit Log</h2>
          <p className="a-section-sub">Recent admin and reward actions</p>
        </div>
      </div>
      <div className="a-card">
        <div className="a-audit-list">
          {entries.length === 0 && <div className="a-table-empty">No audit entries yet.</div>}
          {entries.map(entry => (
            <div key={entry.id} className="a-audit-item">
              <div className="a-audit-top">
                <div className="a-audit-summary">{entry.summary || entry.action}</div>
                <div className="a-audit-time">{timeAgo(entry.created_at)}</div>
              </div>
              <div className="a-audit-meta">
                <span>{entry.admin_email || 'admin'}</span>
                {entry.entity_type && <span>{entry.entity_type}</span>}
                {entry.target_email && <span>{entry.target_email}</span>}
                {entry.entity_id && <span>{entry.entity_id}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
