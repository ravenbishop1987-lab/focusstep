'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import StatCard from './StatCard'
import RevenueCard from './RevenueCard'
import { fetchBodyDoubleAnalytics, fetchMetrics, fetchTranslatorAnalytics } from './admin-api'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null)
  const [traffic, setTraffic] = useState<Record<string, unknown> | null>(null)
  const [bodyDouble, setBodyDouble] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trafficError, setTrafficError] = useState<string | null>(null)
  const [bodyDoubleError, setBodyDoubleError] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([fetchMetrics(), fetchTranslatorAnalytics(), fetchBodyDoubleAnalytics()])
      .then(([metricsResult, trafficResult, bodyDoubleResult]) => {
        if (metricsResult.status === 'fulfilled') {
          setMetrics(metricsResult.value as Record<string, unknown>)
        } else {
          setError(metricsResult.reason instanceof Error ? metricsResult.reason.message : 'Failed to load metrics.')
        }

        if (trafficResult.status === 'fulfilled') {
          setTraffic(trafficResult.value as Record<string, unknown>)
        } else {
          setTrafficError(trafficResult.reason instanceof Error ? trafficResult.reason.message : 'Failed to load translator analytics.')
        }

        if (bodyDoubleResult.status === 'fulfilled') {
          setBodyDouble(bodyDoubleResult.value as Record<string, unknown>)
        } else {
          setBodyDoubleError(bodyDoubleResult.reason instanceof Error ? bodyDoubleResult.reason.message : 'Failed to load body double analytics.')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="a-loading">Loading metrics…</div>
  if (error) return <div className="a-error">Failed to load metrics: {error}</div>
  if (!metrics) return null

  const totalUsers = (metrics.totalUsers as number) || 0
  const totalProMembers = (metrics.totalProMembers as number) || 0
  const convRate = totalUsers > 0 ? ((totalProMembers / totalUsers) * 100).toFixed(1) : 0

  const daily = (traffic?.daily as { date: string; views: number; translateSessions: number; conversionRate: number }[]) ?? []
  const topReferrers = (traffic?.topReferrers as { label: string; views: number }[]) ?? []
  const recentSessions =
    (bodyDouble?.recentSessions as {
      room_id: string
      duration_minutes: number | null
      ended_at: string | null
      user1_goal: string | null
      user2_goal: string | null
    }[]) ?? []
  const siteTrafficDaily =
    (bodyDouble?.siteTrafficDaily as {
      date: string
      homepageViews: number
      homepageVisitors: number
      translateViews: number
      translateVisitors: number
    }[]) ?? []

  const appRoutes = [
    { href: '/dashboard', label: 'User dashboard', sub: 'Jump into the core app home.' },
    { href: '/match', label: 'Body double match', sub: 'Open the live matchmaking flow.' },
    { href: '/schedule', label: 'Schedule', sub: 'Review or post scheduled sessions.' },
    { href: '/friends', label: 'Friends', sub: 'Check accountability relationships.' },
    { href: '/translate', label: 'Task Translator', sub: 'Open the translator product.' },
    { href: '/admin/moderation', label: 'Moderation queue', sub: 'Review reported or blocked content.' },
  ]

  return (
    <div className="a-dashboard">
      <div className="a-stats-grid">
        <StatCard icon="👥" label="Total Users" value={totalUsers.toLocaleString()} />
        <StatCard icon="⭐" label="Pro Members" value={totalProMembers.toLocaleString()} sub={`${convRate}% of users`} accent />
        <StatCard icon="✅" label="Tasks Completed Today" value={((metrics.tasksCompletedToday as number) || 0).toLocaleString()} />
        <StatCard icon="💳" label="Monthly Revenue" value={fmt((metrics.monthlyRevenue as number) || 0)} accent />
        <StatCard icon="💰" label="Total Revenue" value={fmt((metrics.totalRevenue as number) || 0)} />
        <StatCard icon="♾️" label="Lifetime Purchases" value={((metrics.totalLifetimePurchases as number) || 0).toLocaleString()} sub="$49 one-time plan" />
        <StatCard icon="🏦" label="Lifetime Revenue" value={fmt((metrics.lifetimeRevenue as number) || 0)} />
      </div>

      <div className="a-insights-row">
        <div className="a-card a-insight-card">
          <div className="a-insight-icon">🧱</div>
          <div>
            <div className="a-insight-label">Top Stuck Step</div>
            <div className="a-insight-value">{(metrics.topStuckStep as string) || '—'}</div>
            <div className="a-insight-hint">Most requested help-step</div>
          </div>
        </div>
        <div className="a-card a-insight-card">
          <div className="a-insight-icon">🔥</div>
          <div>
            <div className="a-insight-label">Most Used Task</div>
            <div className="a-insight-value">{(metrics.mostUsedTask as string) || '—'}</div>
            <div className="a-insight-hint">Highest cache hit count</div>
          </div>
        </div>
      </div>

      <RevenueCard metrics={metrics} />

      <div className="a-card a-traffic-card" style={{ marginBottom: 20 }}>
        <div className="a-section-header">
          <div>
            <h2 className="a-section-title">App routes</h2>
            <p className="a-section-sub">Use admin as the control center, then jump straight into the live app areas.</p>
          </div>
        </div>
        <div className="a-detail-grid">
          {appRoutes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="a-card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className="a-detail-title" style={{ marginBottom: 8 }}>{route.label}</div>
              <div className="a-section-sub">{route.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      {bodyDoubleError && (
        <div className="a-error" style={{ marginBottom: 20 }}>
          Body Double analytics unavailable: {bodyDoubleError}
        </div>
      )}

      {bodyDouble && (
        <div className="a-card a-traffic-card" style={{ marginBottom: 20 }}>
          <div className="a-section-header">
            <div>
              <h2 className="a-section-title">Body Double reports</h2>
              <p className="a-section-sub">Queue health, session volume, and upcoming focus blocks.</p>
            </div>
          </div>
          <div className="a-stats-grid" style={{ marginBottom: 20 }}>
            <StatCard icon="🎯" label="Completed Sessions" value={((bodyDouble.totalCompletedSessions as number) || 0).toLocaleString()} />
            <StatCard icon="📅" label="Sessions Last 7 Days" value={((bodyDouble.sessionsLast7Days as number) || 0).toLocaleString()} />
            <StatCard icon="⏱️" label="Minutes Last 7 Days" value={((bodyDouble.totalMinutesLast7Days as number) || 0).toLocaleString()} accent />
            <StatCard icon="📈" label="Avg Session Length" value={`${(bodyDouble.avgSessionLength as number) || 0} min`} />
            <StatCard icon="🧍" label="Queue Waiting" value={((bodyDouble.waitingCount as number) || 0).toLocaleString()} />
            <StatCard icon="🤝" label="Queue Matched" value={((bodyDouble.matchedQueueCount as number) || 0).toLocaleString()} />
            <StatCard icon="🗓️" label="Upcoming Scheduled" value={((bodyDouble.upcomingScheduledCount as number) || 0).toLocaleString()} />
            <StatCard icon="✅" label="Claimed Scheduled" value={((bodyDouble.claimedScheduledCount as number) || 0).toLocaleString()} />
          </div>
          <div className="a-detail-grid">
            <div className="a-detail-section">
              <div className="a-detail-title">Recent completed sessions</div>
              <div className="a-mini-list">
                {recentSessions.length === 0 && <div className="a-table-empty">No completed sessions yet.</div>}
                {recentSessions.map((session) => (
                  <div key={`${session.room_id}-${session.ended_at ?? 'pending'}`} className="a-mini-row">
                    <span>{session.ended_at ? new Date(session.ended_at).toLocaleString() : 'In progress'}</span>
                    <span>
                      {(session.duration_minutes ?? 0)} min
                      {session.user1_goal || session.user2_goal
                        ? ` · ${(session.user1_goal || session.user2_goal || '').slice(0, 48)}`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="a-detail-section">
              <div className="a-detail-title">Body Double admin actions</div>
              <div className="a-mini-list">
                <div className="a-mini-row"><span>Open live matchmaking</span><Link href="/match">Go</Link></div>
                <div className="a-mini-row"><span>Review scheduling flow</span><Link href="/schedule">Go</Link></div>
                <div className="a-mini-row"><span>Review moderation queue</span><Link href="/admin/moderation">Go</Link></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {bodyDouble && (
        <div className="a-card a-traffic-card" style={{ marginBottom: 20 }}>
          <div className="a-section-header">
            <div>
              <h2 className="a-section-title">Site traffic</h2>
              <p className="a-section-sub">Daily visitors for the homepage and Task Translator routes.</p>
            </div>
          </div>
          <div className="a-stats-grid" style={{ marginBottom: 20 }}>
            <StatCard icon="🏠" label="Homepage Views Today" value={((bodyDouble.homepageTodayViews as number) || 0).toLocaleString()} />
            <StatCard icon="🧍" label="Homepage Visitors Today" value={((bodyDouble.homepageTodayVisitors as number) || 0).toLocaleString()} />
            <StatCard icon="📝" label="Translate Views Today" value={((bodyDouble.translateTodayViews as number) || 0).toLocaleString()} accent />
            <StatCard icon="✨" label="Translate Visitors Today" value={((bodyDouble.translateTodayVisitors as number) || 0).toLocaleString()} />
          </div>
          <div className="a-detail-section">
            <div className="a-detail-title">Last 7 Days by route</div>
            <div className="a-mini-list">
              {siteTrafficDaily.length === 0 && <div className="a-table-empty">No page analytics data yet.</div>}
              {siteTrafficDaily.map((day) => (
                <div key={day.date} className="a-mini-row">
                  <span>{day.date}</span>
                  <span>
                    / {day.homepageViews} views · {day.homepageVisitors} visitors
                    {' | '}
                    /translate {day.translateViews} views · {day.translateVisitors} visitors
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {trafficError && (
        <div className="a-error" style={{ marginBottom: 20 }}>
          Translator analytics unavailable: {trafficError}
        </div>
      )}

      {traffic && (
        <div className="a-card a-traffic-card">
          <div className="a-section-header">
            <div>
              <h2 className="a-section-title">Translator Traffic</h2>
              <p className="a-section-sub">Homepage visitors and traffic sources</p>
            </div>
          </div>
          <div className="a-stats-grid" style={{ marginBottom: 20 }}>
            <StatCard icon="👀" label="Views Today" value={(traffic.viewsToday as number || 0).toLocaleString()} />
            <StatCard icon="🧍" label="Unique Visitors" value={(traffic.uniqueVisitorsToday as number || 0).toLocaleString()} />
            <StatCard icon="🪪" label="Unique Sessions" value={(traffic.uniqueSessionsToday as number || 0).toLocaleString()} />
            <StatCard icon="⚡" label="Started Today" value={(traffic.translateSessionsToday as number || 0).toLocaleString()} sub={`${traffic.conversionRateToday || 0}% conversion`} accent />
            <StatCard icon="🕶️" label="Anonymous Views" value={(traffic.anonymousViewsToday as number || 0).toLocaleString()} sub={`${(traffic.signedInViewsToday as number || 0).toLocaleString()} signed-in`} />
          </div>
          <div className="a-detail-grid">
            <div className="a-detail-section">
              <div className="a-detail-title">Last 7 Days</div>
              <div className="a-mini-list">
                {daily.map(day => (
                  <div key={day.date} className="a-mini-row">
                    <span>{day.date}</span>
                    <span>{day.views} views · {day.translateSessions} starts · {day.conversionRate}% conv</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="a-detail-section">
              <div className="a-detail-title">Conversion Summary</div>
              <div className="a-mini-list">
                <div className="a-mini-row">
                  <span>Today</span>
                  <span>{(traffic.translateSessionsToday as number) || 0} / {(traffic.uniqueSessionsToday as number) || 0} sessions · {(traffic.conversionRateToday as number) || 0}%</span>
                </div>
                <div className="a-mini-row">
                  <span>Last 30 days</span>
                  <span>{(traffic.last30DayTranslateSessions as number) || 0} / {(traffic.last30DayViewSessions as number) || 0} sessions · {(traffic.last30DayConversionRate as number) || 0}%</span>
                </div>
              </div>
            </div>
            <div className="a-detail-section">
              <div className="a-detail-title">Top Referrers</div>
              <div className="a-mini-list">
                {topReferrers.length === 0 && <div className="a-table-empty">No referrer data yet.</div>}
                {topReferrers.map(ref => (
                  <div key={ref.label} className="a-mini-row">
                    <span>{ref.label}</span>
                    <span>{ref.views}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
