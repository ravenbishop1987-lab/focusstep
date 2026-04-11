import { useState, useEffect } from 'react';
import { fetchRevenue, fetchMetrics } from './api';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

export default function RevenueCard() {
  const [revenue, setRevenue] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchRevenue(), fetchMetrics()])
      .then(([rev, met]) => { setRevenue(rev); setMetrics(met); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="a-card a-revenue-card"><div className="a-loading-sm">Loading revenue…</div></div>;

  const max = revenue.length ? Math.max(...revenue.map(r => r.amount), 1) : 1;
  const subRevenue = metrics ? (metrics.totalRevenue || 0) - (metrics.lifetimeRevenue || 0) : 0;

  return (
    <div className="a-card a-revenue-card">
      <h3 className="a-card-title">Revenue Breakdown</h3>

      {metrics && (
        <div className="a-rev-split">
          <div className="a-rev-item">
            <span className="a-rev-dot a-rev-dot-sub" />
            <div>
              <div className="a-rev-amt">{fmt(subRevenue)}</div>
              <div className="a-rev-lbl">Subscription Income</div>
            </div>
          </div>
          <div className="a-rev-item">
            <span className="a-rev-dot a-rev-dot-life" />
            <div>
              <div className="a-rev-amt">{fmt(metrics.lifetimeRevenue)}</div>
              <div className="a-rev-lbl">Lifetime Purchases ({metrics.totalLifetimePurchases})</div>
            </div>
          </div>
          <div className="a-rev-item a-rev-total">
            <span className="a-rev-dot a-rev-dot-total" />
            <div>
              <div className="a-rev-amt">{fmt(metrics.totalRevenue)}</div>
              <div className="a-rev-lbl">Total Revenue</div>
            </div>
          </div>
        </div>
      )}

      <div className="a-chart-title">Monthly Revenue Trend</div>
      <div className="a-bar-chart">
        {revenue.map(({ month, amount }) => (
          <div key={month} className="a-bar-col">
            <div className="a-bar-wrap">
              <div className="a-bar" style={{ height: `${(amount / max) * 100}%` }} title={fmt(amount)} />
            </div>
            <div className="a-bar-label">{month}</div>
            <div className="a-bar-value">{fmt(amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
