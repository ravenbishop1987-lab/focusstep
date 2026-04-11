import { useState, useEffect } from 'react';
import StatCard from './StatCard';
import RevenueCard from './RevenueCard';
import { fetchMetrics, fetchTranslatorAnalytics } from './api';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchMetrics(), fetchTranslatorAnalytics()])
      .then(([metricData, trafficData]) => {
        setMetrics(metricData);
        setTraffic(trafficData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="a-loading">Loading metrics…</div>;
  if (error) return <div className="a-error">Failed to load metrics: {error}</div>;

  const convRate = metrics.totalUsers > 0
    ? ((metrics.totalProMembers / metrics.totalUsers) * 100).toFixed(1)
    : 0;

  return (
    <div className="a-dashboard">
      <div className="a-stats-grid">
        <StatCard icon="👥" label="Total Users" value={(metrics.totalUsers || 0).toLocaleString()} />
        <StatCard icon="⭐" label="Pro Members" value={(metrics.totalProMembers || 0).toLocaleString()} sub={`${convRate}% of users`} accent />
        <StatCard icon="✅" label="Tasks Completed Today" value={(metrics.tasksCompletedToday || 0).toLocaleString()} />
        <StatCard icon="💳" label="Monthly Revenue" value={fmt(metrics.monthlyRevenue)} accent />
        <StatCard icon="💰" label="Total Revenue" value={fmt(metrics.totalRevenue)} />
        <StatCard icon="♾️" label="Lifetime Purchases" value={(metrics.totalLifetimePurchases || 0).toLocaleString()} sub="$49 one-time plan" />
        <StatCard icon="🏦" label="Lifetime Revenue" value={fmt(metrics.lifetimeRevenue)} />
      </div>

      <div className="a-insights-row">
        <div className="a-card a-insight-card">
          <div className="a-insight-icon">🧱</div>
          <div>
            <div className="a-insight-label">Top Stuck Step</div>
            <div className="a-insight-value">{metrics.topStuckStep || '—'}</div>
            <div className="a-insight-hint">Most requested help-step</div>
          </div>
        </div>
        <div className="a-card a-insight-card">
          <div className="a-insight-icon">🔥</div>
          <div>
            <div className="a-insight-label">Most Used Task</div>
            <div className="a-insight-value">{metrics.mostUsedTask || '—'}</div>
            <div className="a-insight-hint">Highest cache hit count</div>
          </div>
        </div>
      </div>

      <RevenueCard />

      {traffic && (
        <div className="a-card a-traffic-card">
          <div className="a-section-header">
            <div>
              <h2 className="a-section-title">Translator Traffic</h2>
              <p className="a-section-sub">Homepage visitors and traffic sources</p>
            </div>
          </div>

          <div className="a-stats-grid" style={{ marginBottom: 20 }}>
            <StatCard icon="👀" label="Views Today" value={(traffic.viewsToday || 0).toLocaleString()} />
            <StatCard icon="🧍" label="Unique Visitors" value={(traffic.uniqueVisitorsToday || 0).toLocaleString()} />
            <StatCard icon="🪪" label="Unique Sessions" value={(traffic.uniqueSessionsToday || 0).toLocaleString()} />
            <StatCard icon="⚡" label="Started Today" value={(traffic.translateSessionsToday || 0).toLocaleString()} sub={`${traffic.conversionRateToday || 0}% conversion`} accent />
            <StatCard icon="🕶️" label="Anonymous Views" value={(traffic.anonymousViewsToday || 0).toLocaleString()} sub={`${(traffic.signedInViewsToday || 0).toLocaleString()} signed-in`} />
          </div>

          <div className="a-detail-grid">
            <div className="a-detail-section">
              <div className="a-detail-title">Last 7 Days</div>
              <div className="a-mini-list">
                {(traffic.daily || []).map((day) => (
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
                  <span>{traffic.translateSessionsToday || 0} / {traffic.uniqueSessionsToday || 0} sessions · {traffic.conversionRateToday || 0}%</span>
                </div>
                <div className="a-mini-row">
                  <span>Last 30 days</span>
                  <span>{traffic.last30DayTranslateSessions || 0} / {traffic.last30DayViewSessions || 0} sessions · {traffic.last30DayConversionRate || 0}%</span>
                </div>
              </div>
            </div>

            <div className="a-detail-section">
              <div className="a-detail-title">Top Referrers</div>
              <div className="a-mini-list">
                {(traffic.topReferrers || []).length === 0 && <div className="a-table-empty">No referrer data yet.</div>}
                {(traffic.topReferrers || []).map((ref) => (
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
  );
}
