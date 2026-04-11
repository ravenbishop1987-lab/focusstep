import { useState, useEffect } from "react";
import { authFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";
const CONFETTI_COLORS = ["#ff8a65", "#f6c453", "#78c2ad", "#6aa9ff", "#f28bb3", "#9c88ff"];

// Status options the recipient can choose
const RESPONSES = [
  { status: "accepted", label: "I'm cheering you on", emoji: "◎", desc: "I see this and I'm with you." },
  { status: "completed", label: "That's done!", emoji: "✓", desc: "Mark it as finished together." },
  { status: "declined", label: "Pass for now", emoji: "·", desc: "No pressure — just passing this one." },
];

export default function TaskSharePublicPage({ user, onSignupNeeded, onNavigate }) {
  // Extract share code from URL path: /task-share/SHARECODE
  const shareCode = window.location.pathname.split("/task-share/")[1]?.split("/")[0] || "";

  const [sharedTask, setSharedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [responded, setResponded] = useState(null);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState(null);
  const [attachKey, setAttachKey] = useState("");
  const [confettiPieces, setConfettiPieces] = useState([]);

  useEffect(() => {
    if (!shareCode) { setNotFound(true); setLoading(false); return; }

    // Log the click and fetch task data
    fetch(`${API_URL}/api/task-share/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareCode }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); setLoading(false); return; }
        setSharedTask(data);
        setLoading(false);

        // Store pending share code for post-sign-in attachment
        if (!user) {
          localStorage.setItem("pendingTaskShare", shareCode);
        }
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [shareCode, user]);

  useEffect(() => {
    if (!user?.id || !shareCode) return;

    const pending = localStorage.getItem("pendingTaskShare");
    const codeToAttach = pending || shareCode;
    const nextAttachKey = `${user.id}:${codeToAttach}`;
    if (attachKey === nextAttachKey) return;

    setAttachKey(nextAttachKey);
    authFetch(`${API_URL}/api/task-share/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareCode: codeToAttach }),
    })
      .then(() => {
        if (pending === codeToAttach) {
          localStorage.removeItem("pendingTaskShare");
        }
      })
      .catch(() => {});
  }, [user, shareCode, attachKey]);

  const handleRespond = async (status) => {
    if (!user) { onSignupNeeded?.("share"); return; }
    setResponding(true);
    setError(null);
    try {
      await authFetch(`${API_URL}/api/task-share/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode }),
      });

      const res = await authFetch(`${API_URL}/api/task-share/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode, status }),
      });
      const data = await res.json();
      if (data.ok) {
        setResponded(status);
        if (status === "completed") {
          setConfettiPieces(
            Array.from({ length: 24 }, (_, i) => ({
              id: `${Date.now()}-${i}`,
              left: 8 + Math.random() * 84,
              delay: Math.random() * 0.2,
              duration: 1.8 + Math.random() * 0.8,
              rotate: -180 + Math.random() * 360,
              color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            }))
          );
          window.setTimeout(() => setConfettiPieces([]), 2600);
        }
      } else {
        setError(data.error || "Could not save your response.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="share-public-page">
        <div className="share-public-loading">Opening shared task…</div>
      </div>
    );
  }

  if (notFound || !sharedTask) {
    return (
      <div className="share-public-page">
        <div className="share-public-notfound">
          <div className="notfound-icon">◎</div>
          <h2>This share link has expired or doesn&apos;t exist</h2>
          <p>The person who sent it may have removed it, or the link might be incomplete.</p>
          <button className="btn-primary" onClick={() => onNavigate?.("app")}>
            Go to Focus Step
          </button>
        </div>
      </div>
    );
  }

  const steps = sharedTask.result?.steps || [];

  return (
    <div className="share-public-page">
      <div className="share-public-card">
        {confettiPieces.length > 0 && (
          <div className="share-confetti-burst" aria-hidden="true">
            {confettiPieces.map((piece) => (
              <span
                key={piece.id}
                className="share-confetti-piece"
                style={{
                  left: `${piece.left}%`,
                  background: piece.color,
                  animationDelay: `${piece.delay}s`,
                  animationDuration: `${piece.duration}s`,
                  "--confetti-drift": `${-90 + Math.random() * 180}px`,
                  "--confetti-spin-start": `${piece.rotate}deg`,
                }}
              />
            ))}
          </div>
        )}
        {/* Header */}
        <div className="share-public-header">
          <div className="share-public-logo">
            <span className="logo-icon">◎</span>
            <span className="logo-text">Focus<em>Step</em></span>
          </div>
          <p className="share-public-tagline">Someone shared a task with you for support</p>
        </div>

        {/* Task */}
        <div className="share-public-task">
          <div className="share-public-task-label">The task</div>
          <h2 className="share-public-task-text">{sharedTask.task}</h2>
          {sharedTask.result?.simplified && sharedTask.result.simplified !== sharedTask.task && (
            <p className="share-public-simplified">{sharedTask.result.simplified}</p>
          )}
        </div>

        {/* Steps */}
        {steps.length > 0 && (
          <div className="share-public-steps">
            <div className="share-steps-label">Broken down into steps</div>
            {steps.map((step, i) => (
              <div key={i} className="share-step-item">
                <div className="share-step-num">{i + 1}</div>
                <div className="share-step-body">
                  <div className="share-step-action">{step.action}</div>
                  {step.detail && <div className="share-step-detail">{step.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Response area */}
        <div className="share-public-respond">
          {responded ? (
            <div className="share-responded">
              {responded === "accepted" && (
                <>
                  <div className="respond-success-icon">◎</div>
                  <p className="respond-success-text">You&apos;re cheering them on. That matters more than you think.</p>
                </>
              )}
              {responded === "completed" && (
                <>
                  <div className="respond-success-icon">✓</div>
                  <p className="respond-success-text">Marked as done. That&apos;s a real win.</p>
                </>
              )}
              {responded === "declined" && (
                <>
                  <p className="respond-success-text">Got it — no pressure.</p>
                </>
              )}
            </div>
          ) : user ? (
            <>
              <p className="share-respond-prompt">Let them know you saw this:</p>
              {error && <div className="share-respond-error">{error}</div>}
              <div className="share-respond-options">
                {RESPONSES.map((opt) => (
                  <button
                    key={opt.status}
                    className="share-respond-btn"
                    onClick={() => handleRespond(opt.status)}
                    disabled={responding}
                  >
                    <span className="respond-btn-emoji">{opt.emoji}</span>
                    <span className="respond-btn-label">{opt.label}</span>
                    <span className="respond-btn-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="share-signin-nudge">
              <p>Sign in to let them know you&apos;re cheering them on.</p>
              <button
                className="btn-primary"
                onClick={() => onSignupNeeded?.("share")}
              >
                Sign in to respond
              </button>
              <p className="share-signin-sub">
                New here?{" "}
                <button className="link-btn" onClick={() => onNavigate?.("pricing")}>
                  Try Focus Step free
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {!user && (
          <div className="share-public-footer">
            <p className="share-footer-tagline">Built for ADHD brains</p>
            <button className="btn-outline" onClick={() => onNavigate?.("pricing")}>
              Try it free — focusstepadhd.com
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
