'use client'

type Props = { icon: string; label: string; value: string | number; sub?: string; accent?: boolean }

export default function StatCard({ icon, label, value, sub, accent }: Props) {
  return (
    <div className={`a-card a-stat-card${accent ? ' a-stat-accent' : ''}`}>
      <div className="a-stat-icon">{icon}</div>
      <div className="a-stat-body">
        <div className="a-stat-value">{value}</div>
        <div className="a-stat-label">{label}</div>
        {sub && <div className="a-stat-sub">{sub}</div>}
      </div>
    </div>
  )
}
