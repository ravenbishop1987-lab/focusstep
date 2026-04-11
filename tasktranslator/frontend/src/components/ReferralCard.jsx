import { useState, useEffect } from "react";
import { authFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";

const STATUS_META = {
  clicked:   { label: "Clicked link",  color: "#64748b", bg: "#f1f5f9" },
  signed_up: { label: "Signed up",     color: "#1d4ed8", bg: "#dbeafe" },
  converted: { label: "Purchased",     color: "#065f46", bg: "#d1fae5" },
  rewarded:  { label: "Rewarded",      color: "#7c3aed", bg: "#ede9fe" },
  rejected:  { label: "Rejected",      color: "#991b1b", bg: "#fee2e2" },
};

function timeAgo(iso) {
  if (!iso) return null;
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function maskEmail(email) {
  if (!email) return "Someone";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

export default function ReferralCard({ user, isPro, plan }) {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    authFetch(`${API_URL}/referral/me`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [user]);

  const handleCopy = () => {
    if (!data?.link) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent("Focus Step has been helpful for my ADHD. If it would help you too, try it here:");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(data.link)}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent("This might help if ADHD makes starting tasks hard");
    const body = encodeURIComponent(`Hey! Focus Step has been helping me break overwhelming tasks into simpler steps.\n\nIf it would help you too, try it here: ${data.link}\n\nIf you end up upgrading, I get extra Pro time too.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  if (!user) return (
    <div className="ref-card ref-locked">
      <div className="ref-lock-icon">🔒</div>
      <p>Sign in to get your referral link</p>
    </div>
  );

  const isLifetime = plan === "lifetime";
  const rewardDays = isPro && !isLifetime ? 30 : 14;
  const programPaused = data?.programEnabled === false;

  const proExpiry = data?.proExpiresAt ? new Date(data.proExpiresAt) : null;
  const daysLeft = proExpiry ? Math.max(0, Math.ceil((proExpiry - Date.now()) / 86400000)) : null;

  return (
    <div className="ref-dashboard">

      {/* Header */}
      <div className="ref-header">
        <h2 className="ref-title">Help a Friend With ADHD</h2>
        <p className="ref-sub">
          {programPaused
            ? "Referrals are paused right now, but your past invites and rewards are still here."
            : isLifetime
            ? "Share Focus Step with someone who could use calmer, ADHD-friendly support."
            : (
              <>
                Help a friend get support for hard-to-start tasks. If they become a paying Pro member, you get{" "}
                <strong>{rewardDays} free Pro days</strong>
                {rewardDays >= 30 ? ", basically a free month" : ""}
                {data?.maxRewardDays ? `, up to ${data.maxRewardDays} total bonus days.` : "."}
              </>
            )}
        </p>
      </div>

      {/* Stats row */}
      {data && (
        <div className="ref-stats-row">
          <div className="ref-stat">
            <span className="ref-stat-val">{data.total}</span>
            <span className="ref-stat-lbl">Invited</span>
          </div>
          <div className="ref-stat">
            <span className="ref-stat-val">{data.converted}</span>
            <span className="ref-stat-lbl">Converted</span>
          </div>
          <div className="ref-stat">
            <span className="ref-stat-val">{data.rewarded}</span>
            <span className="ref-stat-lbl">Rewarded</span>
          </div>
          <div className="ref-stat ref-stat-accent">
            <span className="ref-stat-val">{data.totalDays}</span>
            <span className="ref-stat-lbl">Days earned</span>
          </div>
        </div>
      )}

      {/* Pro expiry banner */}
      {daysLeft !== null && daysLeft > 0 && (
        <div className="ref-expiry-banner">
          Pro active via referrals — <strong>{daysLeft} days remaining</strong>
          {proExpiry && ` (expires ${proExpiry.toLocaleDateString()})`}
        </div>
      )}

      {data && !programPaused && (
        <div className="ref-empty" style={{ marginBottom: 14 }}>
          Rewards only trigger after a real paid upgrade, and your bonus Pro time is capped at {data.maxRewardDays} days total.
        </div>
      )}

      {programPaused && (
        <div className="ref-empty" style={{ marginBottom: 14 }}>
          Referral rewards are temporarily paused by admin. Your link history is still saved here.
        </div>
      )}

      {/* Referral link */}
      {data && !programPaused && (
        <div className="ref-link-section">
          <label className="ref-link-label">Your referral link</label>
          <div className="ref-link-row">
            <span className="ref-link-text">{data.link}</span>
            <button className="ref-copy-btn" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="ref-share-row">
            <button className="ref-share-btn ref-share-twitter" onClick={handleShareTwitter}>
              Share on X
            </button>
            <button className="ref-share-btn ref-share-email" onClick={handleShareEmail}>
              Share via Email
            </button>
          </div>
        </div>
      )}

      {/* Referral list */}
      {data?.referrals?.length > 0 && (
        <div className="ref-list-section">
          <h3 className="ref-list-title">Your invites</h3>
          <div className="ref-list">
            {data.referrals.map(r => {
              const meta = STATUS_META[r.status] || STATUS_META.clicked;
              return (
                <div key={r.id} className="ref-list-row">
                  <div className="ref-list-email">{maskEmail(r.referred_email)}</div>
                  <div className="ref-list-mid">
                    <span className="ref-status-badge" style={{ color: meta.color, background: meta.bg }}>
                      {meta.label}
                    </span>
                    {r.status === "rewarded" && r.reward_value && (
                      <span className="ref-reward-tag">+{r.reward_value}d Pro</span>
                    )}
                  </div>
                  <div className="ref-list-time">{timeAgo(r.clicked_at)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {data && (data.referrals?.length ?? 0) === 0 && (
        <div className="ref-empty">
          No invites yet. Share your link when someone in your life could use a little ADHD support.
        </div>
      )}

    </div>
  );
}
