import { useEffect, useRef, useState } from "react";
import StepExecution from "./StepExecution";

const API_URL = import.meta.env.VITE_API_URL || "";
const LOADING_MESSAGES = ["Finding the first move...", "Making it smaller...", "Keeping it simple...", "Almost there..."];

function getAnalyticsSessionId() {
  const key = "focusstep_analytics_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(key, next);
  return next;
}

function speakText(text) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

function Step({ index, step, task, userEmail, onLimitReached }) {
  const [showHelp, setShowHelp] = useState(false);
  const [helpQuestion, setHelpQuestion] = useState("");
  const [helpResult, setHelpResult] = useState(null);
  const [loadingHelp, setLoadingHelp] = useState(false);
  const [helpError, setHelpError] = useState(null);

  const isObj = typeof step === "object" && step.action;
  const action = isObj ? step.action : step;
  const detail = isObj ? step.detail : null;

  const handleGetHelp = async (q) => {
    const question = q !== undefined ? q : helpQuestion;
    setLoadingHelp(true);
    setHelpError(null);
    try {
      const res = await fetch(API_URL + "/help-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, stepAction: action, stepDetail: detail, question, email: userEmail }),
      });
      const data = await res.json();
      if (res.status === 429) { onLimitReached(); return; }
      if (!res.ok) { setHelpError(data.error || "Something went wrong."); return; }
      setHelpResult(data);
      setShowHelp(false);
      setHelpQuestion("");
    } catch {
      setHelpError("Couldn't connect to the server.");
    } finally {
      setLoadingHelp(false);
    }
  };

  return (
    <li className="step-item">
      <div className="step-num">{index + 1}</div>
      <div className="step-content">
        <div className="step-action-row">
          <span className="step-action">{action}</span>
          <button className="audio-btn" title="Read aloud" onClick={() => speakText(action + (detail ? ". " + detail : ""))}>🔊</button>
        </div>
        {detail && <div className="step-detail">{detail}</div>}
        {helpResult && (
          <div className="step-help-result">
            <div className="step-help-text">{helpResult.helpText}</div>
            <ul className="step-substeps">
              {helpResult.subSteps.map((sub, i) => (
                <li key={i} className="step-substep"><span className="substep-dot">→</span><span>{sub}</span></li>
              ))}
            </ul>
            <div className="help-result-actions">
              <button className="help-dismiss" onClick={() => setHelpResult(null)}>Got it ✓</button>
              <button className="audio-btn" title="Read aloud" onClick={() => speakText(helpResult.helpText + ". " + helpResult.subSteps.join(". "))}>🔊</button>
            </div>
          </div>
        )}
        {!helpResult && showHelp && (
          <div className="step-help-input-area">
            <p className="step-help-prompt">What part are you stuck on? <span>(optional)</span></p>
            <div className="suggested-btns">
              {["Give me more detail", "What do I need for this?", "What if I get stuck here?"].map((q, i) => (
                <button key={i} className="suggested-btn" onClick={() => handleGetHelp(q)} disabled={loadingHelp}>{q}</button>
              ))}
            </div>
            <textarea className="step-help-textarea" placeholder="Or type your own question here…" value={helpQuestion} onChange={e => setHelpQuestion(e.target.value)} rows={2} disabled={loadingHelp} />
            {helpError && <p className="help-error">{helpError}</p>}
            <div className="step-help-actions">
              <button className="followup-cancel" onClick={() => { setShowHelp(false); setHelpQuestion(""); setHelpError(null); }}>Cancel</button>
              <button className="translate-btn" style={{ padding: "9px 16px", fontSize: "0.85rem" }} onClick={() => handleGetHelp()} disabled={loadingHelp}>
                {loadingHelp ? "Getting help…" : "Get Help →"}
              </button>
            </div>
          </div>
        )}
        {!helpResult && !showHelp && (
          <button className="step-help-trigger" onClick={() => setShowHelp(true)}>+ I need help with this step</button>
        )}
      </div>
    </li>
  );
}

function HistoryView({ entries, emptyMsg, isFavorited, toggleFavorite, userEmail, onDelete, onClearAll }) {
  const [expanded, setExpanded] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : true
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = (event) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile) setExpanded(null);
  }, [isMobile]);

  if (!entries || entries.length === 0) {
    return <p className="empty-state">{emptyMsg}</p>;
  }

  const toggle = (id) => {
    if (!isMobile) return;
    setExpanded(expanded === id ? null : id);
  };

  return (
    <div className="history-list">
      <div className="history-list-header">
        <span className="history-count">{entries.length} saved</span>
        <button className="clear-all-btn" onClick={() => { if(window.confirm("Clear all? This cannot be undone.")) onClearAll && onClearAll(); }}>
          Clear All
        </button>
      </div>
      {entries.map(entry => (
        <div key={entry.id} className={"accordion-item" + (isMobile && expanded === entry.id ? " open" : "")}>

          <div className="accordion-header" onClick={() => toggle(entry.id)}>
            <div className="accordion-left">
              {isMobile && <span className="accordion-chevron">{expanded === entry.id ? "▲" : "▼"}</span>}
              <span className="accordion-task">{entry.task}</span>
            </div>
            <div className="accordion-right">
              <span className="history-date">{entry.date}</span>
              <button
                className={"fav-btn" + (isFavorited && isFavorited(entry.id) ? " faved" : "")}
                onClick={e => { e.stopPropagation(); toggleFavorite && toggleFavorite(entry); }}
                title={isFavorited && isFavorited(entry.id) ? "Remove from favorites" : "Save to favorites"}
              >
                {isFavorited && isFavorited(entry.id) ? "★" : "☆"}
              </button>
              <button
                className="delete-entry-btn"
                onClick={e => { e.stopPropagation(); onDelete && onDelete(entry.id); }}
                title="Delete this entry"
              >✕</button>
            </div>
          </div>

          {(isMobile ? expanded === entry.id : true) && (
            <div className="accordion-body">
              <div className="start-here-section">
                <div className="start-here-label">Start Here</div>
                <div className="start-here-row">
                  <div className="start-here-text">{entry.result.startHere}</div>
                  <button className="audio-btn" onClick={() => speakText("Start here. " + entry.result.startHere)}>🔊</button>
                </div>
                {entry.result.startTime && <div className="time-badge">{"~" + entry.result.startTime + " to begin"}</div>}
              </div>
              <div className="steps-section">
                <div className="steps-label">Detailed Steps</div>
                <ol className="steps-list">
                  {entry.result.steps.map((step, i) => (
                    <Step key={i} index={i} step={step} task={entry.task} userEmail={userEmail} onLimitReached={() => {}} />
                  ))}
                </ol>
              </div>
            </div>
          )}

        </div>
      ))}
    </div>
  );
}

function LeadCaptureModal({ email, onEmailChange, onClose, onSubmit, onOpenPricing, loading, error, success }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal lead-capture-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="lead-capture-title">
        <button className="modal-close" onClick={onClose} aria-label="Close">Close</button>
        <div className="lead-capture-badge">One free translation used</div>
        <h2 id="lead-capture-title" className="auth-headline">Want more translations?</h2>
        <p className="auth-sub">Upgrade to get unstuck faster. Leave your email and we&apos;ll keep the next step easy.</p>

        {success ? (
          <div className="lead-capture-success">
            <p>Thanks. Your email is saved, and your upgrade path is ready.</p>
            <button className="upgrade-btn-primary" onClick={onOpenPricing}>See plans</button>
          </div>
        ) : (
          <>
            <input
              className="auth-email-input lead-capture-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              autoComplete="email"
              autoFocus
            />
            {error && <p className="auth-error">{error}</p>}
            <div className="lead-capture-actions">
              <button className="upgrade-btn-primary" onClick={onSubmit} disabled={loading || !email.trim()}>
                {loading ? "Saving..." : "Save email and continue"}
              </button>
              <button className="upgrade-link" onClick={onOpenPricing}>Skip to pricing</button>
            </div>
            <p className="lead-capture-note">Calm support, no spammy pressure.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function Translator({ onUpgrade, onSignupNeeded, onLeadCaptured, onOpenPricing, user, isPro, plan, history, favorites, addToHistory, toggleFavorite, isFavorited, subView, setSubView, deleteHistory, deleteFavorite, clearAllHistory, clearAllFavorites }) {
  const userEmail = user?.email || "";
  const [task, setTask] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [startMode, setStartMode] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);
  const intervalRef = useRef(null);
  const textareaRef = useRef(null);

  const startInterval = (msgs) => {
    setLoadingMsg(0);
    intervalRef.current = setInterval(() => setLoadingMsg(m => (m + 1) % msgs.length), 1800);
  };

  const handleExampleClick = (example) => {
    setTask(example);
    textareaRef.current?.focus();
  };

  const handleLeadSubmit = async () => {
    const trimmed = leadEmail.trim();
    if (!trimmed) return;
    setLeadLoading(true);
    setLeadError("");
    try {
      const res = await fetch(`${API_URL}/capture-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLeadError(data.error || "Could not save your email just now.");
        return;
      }
      setLeadSaved(true);
      onLeadCaptured?.(trimmed);
    } catch {
      setLeadError("Could not save your email just now.");
    } finally {
      setLeadLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!task.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLimitReached(false);
    startInterval(LOADING_MESSAGES);
    fetch(API_URL + "/analytics/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageKey: "translate_submit",
        path: window.location.pathname || "/",
        sessionId: getAnalyticsSessionId(),
        userId: user?.id || null,
        userEmail: userEmail || null,
        referrer: document.referrer || "",
      }),
    }).catch(() => {});
    try {
      const res = await fetch(API_URL + "/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, email: userEmail }),
      });
      const data = await res.json();
      if (res.status === 429) { setLimitReached(true); return; }
      if (!res.ok) { setError(data.error || "Something went wrong."); return; }
      setResult(data);
      setStartMode(true); // auto-enter execution mode
      if (!user && !isPro && data.limit === 1 && data.usage === 1) {
        setLeadEmail((prev) => prev || userEmail || "");
        setLeadSaved(false);
        setLeadError("");
        setLeadModalOpen(true);
      }
      if (addToHistory) {
        const entry = await addToHistory(task, data);
        if (entry?.id) setCurrentTaskId(entry.id);
      }
      if (data.usage != null) setUsage({ used: data.usage, limit: data.limit });
    } catch {
      setError("Couldn't connect to the server.");
    } finally {
      clearInterval(intervalRef.current);
      setLoading(false);
    }
  };


  const remaining = usage ? usage.limit - usage.used : null;

  return (
    <div className="translator-page">


{!isPro && usage && remaining !== null && remaining <= 2 && (
        <p className="usage-nudge">
          {remaining === 0 ? "No free translations left today" : `${remaining} free translation${remaining === 1 ? "" : "s"} left today`}
          {" · "}<button className="upgrade-link" onClick={onUpgrade}>See plans</button>
        </p>
      )}

      {(subView === "history" || subView === "favorites") && isPro && (
        <>
          <div className="history-nav">
            <div className="history-tab-group">
              <button className={"history-tab-btn" + (subView === "history" ? " active" : "")} onClick={() => setSubView("history")}>History</button>
              <button className={"history-tab-btn" + (subView === "favorites" ? " active" : "")} onClick={() => setSubView("favorites")}>Favorites</button>
            </div>
          </div>
          <HistoryView
            entries={subView === "history" ? history : favorites}
            emptyMsg={subView === "history" ? "No history yet. Shorten a task to get started." : "No favorites yet. Star a task breakdown from your history."}
            isFavorited={isFavorited}
            toggleFavorite={toggleFavorite}
            userEmail={userEmail}
            onDelete={subView === "history" ? deleteHistory : deleteFavorite}
            onClearAll={subView === "history" ? clearAllHistory : clearAllFavorites}
          />
        </>
      )}

      {(subView === "translate" || !subView) && !startMode && subView !== "progress" && (
        <div>
          <div className="tool-hero">
            <p className="tool-kicker">FocusStep</p>
            <h1 className="tool-headline">What are you avoiding?</h1>
            <p className="tool-sub">Type the thing you keep not starting. We&apos;ll give you one step small enough to do now.</p>
          </div>
          <div className="input-card">
            <textarea
              ref={textareaRef}
              className="task-input"
              value={task}
              onChange={e => setTask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.metaKey || e.ctrlKey) && handleTranslate()}
              placeholder="That email. The form. The laundry."
              maxLength={300}
              disabled={loading}
              autoFocus
            />
            <div className="example-prompts example-prompts--inline">
              {[
                "Reply to Jen about Thursday",
                "Open the insurance form",
                "Put the laundry in the washer",
                "Call the pharmacy",
                "Open my taxes",
                "Clean the bathroom sink",
              ].map((ex, i) => (
                <button key={i} className="example-chip" onClick={() => handleExampleClick(ex)} disabled={loading}>{ex}</button>
              ))}
            </div>
            <button
              className={`translate-btn translate-btn--full${task.trim() ? " translate-btn--ready" : ""}`}
              onClick={handleTranslate}
              disabled={loading || !task.trim()}
            >
              {loading ? <><span className="btn-spinner" /> Finding the first step...</> : "Show me the first step"}
            </button>
            {loading
              ? <p className="loading-hint">{LOADING_MESSAGES[loadingMsg]}</p>
              : <p className="input-micro">One free translation each day. Just start.</p>
            }
          </div>


          {error && !loading && (
            <div className="error-card"><h3>Something went wrong</h3><p>{error}</p></div>
          )}

          {limitReached && !loading && (
            <div className="limit-reached">
              <h3>You&apos;ve used your free translation for today</h3>
              {user ? (
                <>
                  <p>You started. That matters. Upgrade for more support and keep going while the momentum is there.</p>
                  <button className="upgrade-btn-primary" onClick={onUpgrade}>See upgrade options</button>
                </>
              ) : (
                <>
                  <p>Want more help today? Leave your email or jump straight to the paid plans.</p>
                  <button className="upgrade-btn-primary" onClick={() => setLeadModalOpen(true)}>Get more translations</button>
                  <button className="upgrade-link" style={{ marginTop: "8px" }} onClick={onUpgrade}>Or see all plans</button>
                </>
              )}
            </div>
          )}

        </div>
      )}

      {startMode && result && (
        <StepExecution
          steps={result.steps}
          startHere={result.startHere}
          task={task}
          userEmail={userEmail}
          taskId={currentTaskId}
          user={user}
          onReset={() => {
            setStartMode(false);
            setResult(null);
            setTask("");
            setUsage(null);
            setCurrentTaskId(null);
          }}
          onSignupNeeded={!user ? () => { setStartMode(false); onSignupNeeded("start"); } : null}
          onUpgrade={!isPro ? onUpgrade : null}
        />
      )}

      {leadModalOpen && !user && (
        <LeadCaptureModal
          email={leadEmail}
          onEmailChange={setLeadEmail}
          onClose={() => setLeadModalOpen(false)}
          onSubmit={handleLeadSubmit}
          onOpenPricing={() => {
            if (leadEmail.trim()) onLeadCaptured?.(leadEmail.trim());
            setLeadModalOpen(false);
            onOpenPricing?.();
          }}
          loading={leadLoading}
          error={leadError}
          success={leadSaved}
        />
      )}

    </div>
  );
}
