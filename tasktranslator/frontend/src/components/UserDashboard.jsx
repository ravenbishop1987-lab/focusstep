import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";

const DASHBOARD_TABS = [
  { id: "home", label: "Home" },
  { id: "account", label: "Account" },
];

export default function UserDashboard({ user, isPro, plan, onSignupNeeded, onOpenPricing, onOpenTranslate, onSignOut, defaultTab = "home" }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!user?.id || !user?.email) return;

    setLoading(true);
    setError(null);
    try {
      const [shareRes, referralRes] = await Promise.all([
        authFetch(`${API_URL}/api/task-share/stats`).catch(() => null),
        authFetch(`${API_URL}/referral/me`).catch(() => null),
      ]);

      const shares = shareRes?.ok ? await shareRes.json().catch(() => ({})) : {};
      const referral = referralRes?.ok ? await referralRes.json().catch(() => ({})) : {};

      setSummary({ shares, referral });
    } catch {
      setSummary({ shares: {}, referral: {} });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const firstName = useMemo(() => user?.email?.split("@")[0] || "You", [user]);
  const planLabel = plan === "lifetime" ? "Lifetime" : plan === "monthly" ? "Pro Monthly" : "Free";

  const handleManageBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const res = await authFetch(`${API_URL}/billing-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      window.alert(data.error || "Could not open billing portal.");
    } catch {
      window.alert("Could not connect to the server.");
    } finally {
      setBillingLoading(false);
    }
  }, []);

  const handleShareWithFriend = useCallback(async () => {
    const shareUrl = `${window.location.origin}/join`;
    const shareText = "FocusStep has been helping me turn overwhelming tasks into calmer ADHD-friendly steps.";

    if (navigator.share) {
      try {
        await navigator.share({
          title: "FocusStep",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fall through to copy if native share is cancelled or unavailable.
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt("Copy this link to share FocusStep:", shareUrl);
    }
  }, []);

  if (!user) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">◎</div>
          <h2>Sign in to open your dashboard</h2>
          <p>See your account, referrals, and support tools in one place.</p>
          <button className="btn-primary" onClick={() => onSignupNeeded?.("dashboard")}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const accessLabel = isPro ? "Unlimited" : "3 tasks/day";
  const billingLabel = plan === "monthly" ? "Subscription" : plan === "lifetime" ? "One-time" : "Not started";

  return (
    <div className="dashboard-page dashboard-page-wide">
      <div className="page-fancy-header">
        <div className="page-fancy-kicker">Your space</div>
        <h1 className="page-fancy-title">Hey, {firstName}.</h1>
        <p className="page-fancy-sub">Your calm place to check in, share, and manage your account.</p>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="dashboard-tab-row">
        {DASHBOARD_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`dashboard-tab ${activeTab === tab.id ? "dashboard-tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "home" && (
        <div className="dashboard-overview">
          {loading ? (
            <div className="dashboard-loading">Loading your summary…</div>
          ) : (
            <>
              <div className="overview-hero">
                <div className="overview-hero-copy">
                  <div className="overview-hero-kicker">Home Base</div>
                  <h2 className="overview-hero-title">
                    Keep things simple. Pick one next step, then keep moving.
                  </h2>
                </div>
                <div className="overview-hero-side">
                  <div className="overview-hero-badge">{planLabel}</div>
                  <div className="overview-hero-sub">{accessLabel}</div>
                  <div className="overview-hero-actions">
                    <button className="btn-primary" onClick={() => onOpenTranslate?.()}>
                      Start a task
                    </button>
                    <button className="btn-outline" onClick={() => setActiveTab("account")}>
                      Account & billing
                    </button>
                  </div>
                </div>
              </div>

              <div className="dashboard-share-cta">
                <h2 className="section-title">Share with a friend</h2>
                <p className="section-hint">
                  Send FocusStep to someone with ADHD who could use a calmer way to get started.
                </p>
                <button className="btn-primary" onClick={handleShareWithFriend}>
                  {shareCopied ? "Link copied" : "Share with a friend with ADHD"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "account" && (
        <div className="dashboard-tab-panel">
          <button className="dashboard-mobile-back" onClick={() => setActiveTab("home")}>
            ← Back
          </button>
          <div className="overview-section-card">
            <h2 className="section-title">Account & Billing</h2>
            <p className="section-hint">Your plan, billing access, and account details all in one place.</p>

            <div className="overview-mini-metrics">
              <div className="overview-mini-metric">
                <span className="overview-mini-label">Email</span>
                <span className="overview-mini-value">{user.email}</span>
              </div>
              <div className="overview-mini-metric">
                <span className="overview-mini-label">Current plan</span>
                <span className="overview-mini-value">{planLabel}</span>
              </div>
              <div className="overview-mini-metric">
                <span className="overview-mini-label">Access</span>
                <span className="overview-mini-value">{accessLabel}</span>
              </div>
            </div>

            {plan === "monthly" && (
              <div className="manage-billing" style={{ marginTop: 20 }}>
                <div className="manage-billing-info">
                  <span className="pro-badge" style={{ marginBottom: 0 }}>✓ Pro Monthly</span>
                  <p>Manage your subscription, payment method, or cancellation in Stripe.</p>
                </div>
                <button
                  className="manage-billing-btn"
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                >
                  {billingLoading ? "Opening…" : "Manage Subscription →"}
                </button>
              </div>
            )}

            {plan === "lifetime" && (
              <div className="manage-billing" style={{ marginTop: 20 }}>
                <div className="manage-billing-info">
                  <span className="pro-badge" style={{ marginBottom: 0 }}>✓ Lifetime</span>
                  <p>You have one-time lifetime access. No recurring billing is active.</p>
                </div>
                <button className="manage-billing-btn" onClick={() => window.location.href = "mailto:hello@focusstepadhd.com"}>
                  Contact Support
                </button>
              </div>
            )}

            {!isPro && (
              <div className="manage-billing" style={{ marginTop: 20 }}>
                <div className="manage-billing-info">
                  <span className="pro-badge" style={{ marginBottom: 0 }}>Free Tier</span>
                  <p>Upgrade when you want enough support to keep going, not just get started.</p>
                </div>
                <button className="manage-billing-btn" onClick={() => onOpenPricing?.()}>
                  Start Finishing Tasks
                </button>
              </div>
            )}

            {onSignOut && (
              <div className="account-signout-row">
                <button className="account-signout-btn" onClick={onSignOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

