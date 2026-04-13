import { useEffect, useState } from "react";
import { authFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Pricing({ onBack, userEmail, isPro, plan }) {
  const [loading, setLoading] = useState(null);
  const [openPlan, setOpenPlan] = useState(isPro ? (plan || "plus") : "free");
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
              <div className="plan-name">Free</div>
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
              <div className="plan-desc">A soft place to start when your task feels too loud</div>
              <ul className="plan-features">
                <li>1 translation per day</li>
                <li>Turn "I can&apos;t do this" into one calmer next step</li>
                <li>No signup required to try it</li>
                <li>Best if you want a light daily reset</li>
              </ul>
              <button className="plan-btn cta" onClick={onBack}>Start Free</button>
            </div>
          )}
        </div>

        <div className={`plan-card plan-card-accordion featured ${(!isMobile || openPlan === "plus") ? "plan-card-open" : ""}`}>
          <button
            className="plan-card-toggle"
            onClick={() => isMobile && setOpenPlan("plus")}
            aria-expanded={!isMobile || openPlan === "plus"}
            aria-controls="plan-plus-content"
          >
            <div>
              <div className="plan-name">Plus</div>
              <div className="plan-price">$9 <span>/ month</span></div>
            </div>
            {isMobile && (
              <span className={`plan-card-chevron ${openPlan === "plus" ? "open" : ""}`} aria-hidden="true">
                +
              </span>
            )}
          </button>

          {(!isMobile || openPlan === "plus") && (
            <div id="plan-plus-content" className="plan-card-content">
              <div className="plan-desc">More breathing room when one free translation is not enough</div>
              <ul className="plan-features">
                <li>3 translations per day</li>
                <li>Priority response speed</li>
                <li>Save favorite translations</li>
                <li>Best if you want steady support without going all-in</li>
              </ul>
              <button
                className="plan-btn cta"
                onClick={() => handleCheckout("plus")}
                disabled={loading === "plus" || plan === "plus"}
              >
                {plan === "plus" ? "Current plan" : loading === "plus" ? "Redirecting..." : "Choose Plus"}
              </button>
            </div>
          )}
        </div>

        <div className={`plan-card plan-card-accordion ${(!isMobile || openPlan === "unlimited") ? "plan-card-open" : ""}`}>
          <button
            className="plan-card-toggle"
            onClick={() => isMobile && setOpenPlan("unlimited")}
            aria-expanded={!isMobile || openPlan === "unlimited"}
            aria-controls="plan-unlimited-content"
          >
            <div>
              <div className="plan-name">Unlimited</div>
              <div className="plan-price">$19 <span>/ month</span></div>
            </div>
            {isMobile && (
              <span className={`plan-card-chevron ${openPlan === "unlimited" ? "open" : ""}`} aria-hidden="true">
                +
              </span>
            )}
          </button>

          {(!isMobile || openPlan === "unlimited") && (
            <div id="plan-unlimited-content" className="plan-card-content">
              <div className="plan-desc">For the days when you need as many fresh starts as it takes</div>
              <ul className="plan-features">
                <li>Unlimited translations per day</li>
                <li>Everything in Pro</li>
                <li>Full translation history</li>
                <li>Advanced insights</li>
                <li>Best if FocusStep is part of your daily toolkit</li>
              </ul>
              <button
                className="plan-btn cta"
                onClick={() => handleCheckout("unlimited")}
                disabled={loading === "unlimited" || plan === "unlimited"}
              >
                {plan === "unlimited" ? "Current plan" : loading === "unlimited" ? "Redirecting..." : "Choose Unlimited"}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="pricing-note">
        Secured by Stripe. Both paid plans are monthly and can be canceled anytime in the billing portal.{" "}
        <a href="mailto:hello@focusstepadhd.com" style={{ color: "var(--accent-dark)" }}>
          hello@focusstepadhd.com
        </a>
      </p>
    </div>
  );
}
