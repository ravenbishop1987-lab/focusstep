import { useEffect, useState } from "react";
import { authFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Pricing({ onBack, userEmail, isPro }) {
  const [loading, setLoading] = useState(null);
  const [openPlan, setOpenPlan] = useState(isPro ? "pro" : "free");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 600px)").matches : true
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 600px)");
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleCheckout = async (plan) => {
    setLoading(plan);
    try {
      const res = await fetch(`${API_URL}/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email: userEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Something went wrong. Please try again.");
      }
    } catch {
      alert("Could not connect to the server.");
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("portal");
    try {
      const res = await authFetch(`${API_URL}/billing-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Could not open billing portal.");
      }
    } catch {
      alert("Could not connect to the server.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="pricing-page">
      <div className="page-intro">
        <h1>When your brain won't start,<br /><em>this helps you begin.</em></h1>
        <p>Less overthinking. Less getting stuck. More done.</p>
      </div>

      {isPro && (
        <div className="manage-billing">
          <div className="manage-billing-info">
            <span className="pro-badge" style={{ marginBottom: 0 }}>Pro Active</span>
            <p>You already have extra support when getting started feels hard.</p>
          </div>
          <button
            className="manage-billing-btn"
            onClick={handleManageBilling}
            disabled={loading === "portal"}
          >
            {loading === "portal" ? "Opening..." : "Manage Subscription ->"}
          </button>
        </div>
      )}

      <div className="pricing-grid">
        <div className={`plan-card plan-card-accordion ${(!isMobile || openPlan === "free") ? "plan-card-open" : ""}`}>
          <button
            className="plan-card-toggle"
            onClick={() => isMobile && setOpenPlan("free")}
            aria-expanded={!isMobile || openPlan === "free"}
            aria-controls="plan-free-content"
          >
            <div>
              <div className="plan-name">Start Small</div>
              <div className="plan-price">$0 <span>/ forever</span></div>
            </div>
            {isMobile && (
              <span className={`plan-card-chevron ${openPlan === "free" ? "open" : ""}`} aria-hidden="true">
                +
              </span>
            )}
          </button>

          {(!isMobile || openPlan === "free") && (
            <div id="plan-free-content" className="plan-card-content">
              <div className="plan-desc">Quick relief when a task feels too big</div>
              <ul className="plan-features">
                <li>Get help when a task feels too big</li>
                <li>Turn "I can't do this" into one simple next step</li>
                <li>Try 3 task breakdowns each day</li>
                <li>Best if you want quick relief without pressure</li>
              </ul>
              <button className="plan-btn cta" onClick={onBack}>Start Free</button>
            </div>
          )}
        </div>

        <div className={`plan-card plan-card-accordion featured ${(!isMobile || openPlan === "pro") ? "plan-card-open" : ""}`}>
          <button
            className="plan-card-toggle"
            onClick={() => isMobile && setOpenPlan("pro")}
            aria-expanded={!isMobile || openPlan === "pro"}
            aria-controls="plan-pro-content"
          >
            <div>
              <div className="plan-name">Keep Going</div>
              <div className="plan-price">$9 <span>/ month</span></div>
            </div>
            {isMobile && (
              <span className={`plan-card-chevron ${openPlan === "pro" ? "open" : ""}`} aria-hidden="true">
                +
              </span>
            )}
          </button>

          {(!isMobile || openPlan === "pro") && (
            <div id="plan-pro-content" className="plan-card-content">
              <div className="plan-desc">More support when you do not want to keep restarting</div>
              <ul className="plan-features">
                <li>Get unstuck as often as you need during the month</li>
                <li>Stay with tasks longer instead of giving up halfway</li>
                <li>Save the plans that help so you do not start over</li>
                <li>Get help faster when your focus is slipping</li>
                <li>Best if you want steadier support</li>
              </ul>
              <button
                className="plan-btn cta"
                onClick={() => handleCheckout("monthly")}
                disabled={loading === "monthly" || isPro}
              >
                {isPro ? "Current plan" : loading === "monthly" ? "Redirecting..." : "Get More Support"}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="pricing-note">
        Secured by Stripe. Cancel anytime in the billing portal.{" "}
        <a href="mailto:hello@focusstepadhd.com" style={{ color: "var(--accent-dark)" }}>
          hello@focusstepadhd.com
        </a>
      </p>
    </div>
  );
}
