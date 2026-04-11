import { useState, useCallback, useEffect } from "react";
import confetti from "canvas-confetti";
import { authFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";
const CAPTURE_PROMPT_SHOWN_SESSION_KEY = "focusstep_capture_prompt_shown_session";
const CAPTURE_SUBMITTED_KEY = "focusstep_capture_submitted";

function parseStep(s) {
  return {
    action: typeof s === "string" ? s : s?.action || "",
    detail: typeof s === "object" ? s?.detail || null : null,
  };
}

function shrinkStep(step, depth = 0) {
  const text = String(step || "").trim().toLowerCase();

  const pickByDepth = (items) => items[Math.min(depth, items.length - 1)];

  if (/(inbox|email|mail)/.test(text)) {
    return pickByDepth(["Pick up your phone", "Press power button", "Touch the screen", "Tap the mail app"]);
  }

  if (/(call|phone|dial)/.test(text)) {
    return pickByDepth(["Pick up your phone", "Press power button", "Tap the phone app", "Tap keypad"]);
  }

  if (/(form|document|tax|portal|website|app|login|sign in)/.test(text)) {
    return pickByDepth(["Pick up your phone", "Press power button", "Tap the app", "Tap the first field"]);
  }

  if (/(laundry|washer|clothes)/.test(text)) {
    return pickByDepth(["Walk to the washer", "Touch the washer lid", "Lift the lid", "Drop in one item"]);
  }

  if (/(clean|sink|bathroom|dish|counter)/.test(text)) {
    return pickByDepth(["Walk to the sink", "Pick up the sponge", "Turn on the water", "Touch the surface"]);
  }

  return pickByDepth(["Look at the thing", "Move closer", "Touch it", "Lift one finger"]);
}

function StepCard({ stepNum, totalSteps, action, detail, isIntro, animState, onDone, task, userEmail, onLimitReached }) {
  const [currentAction, setCurrentAction] = useState(action);
  const [queuedSubsteps, setQueuedSubsteps] = useState([]);
  const [statusText, setStatusText] = useState(isIntro ? "Don't think past this one." : "Just do this.");
  const [assistState, setAssistState] = useState("idle");
  const [assistError, setAssistError] = useState("");
  const [stillStuckCount, setStillStuckCount] = useState(0);

  useEffect(() => {
    setCurrentAction(action);
    setQueuedSubsteps([]);
    setAssistState("idle");
    setAssistError("");
    setStillStuckCount(0);
    setStatusText(isIntro ? "Don't think past this one." : "Just do this.");
  }, [action, isIntro, stepNum]);

  const requestSmallerStep = async (mode) => {
    if (mode === "stuck" && stillStuckCount > 0) {
      if (stillStuckCount >= 4) {
        setAssistError("This is as small as it gets. Try just this.");
        setStatusText("This is as small as it gets. Try just this.");
        return;
      }

      const nextAction = shrinkStep(currentAction, stillStuckCount - 1);
      setCurrentAction(nextAction);
      setQueuedSubsteps([]);
      setStillStuckCount(prev => prev + 1);
      setAssistError("");
      setStatusText(stillStuckCount >= 3 ? "This is as small as it gets. Try just this." : "Just this tiny move.");
      return;
    }

    setAssistState(mode);
    setAssistError("");
    try {
      const question = mode === "too-big" ? "Make it smaller" : "Show me the first move";
      const res = await fetch(`${API_URL}/help-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          stepAction: currentAction,
          stepDetail: detail,
          question,
          email: userEmail,
        }),
      });
      const data = await res.json();
      if (res.status === 429) {
        onLimitReached?.();
        return;
      }
      if (!res.ok || !data?.subSteps?.length) {
        setAssistError("Try the tiniest version you can do.");
        return;
      }

      const nextSteps = data.subSteps.filter(Boolean);
      setCurrentAction(nextSteps[0]);
      setQueuedSubsteps(nextSteps.slice(1));
      if (mode === "stuck") setStillStuckCount(1);
      setStatusText(data.helpText || (mode === "too-big" ? "Make it smaller." : "Stay with this one."));
    } catch {
      setAssistError("Try the tiniest version you can do.");
    } finally {
      setAssistState("idle");
    }
  };

  const handleDone = () => {
    if (queuedSubsteps.length > 0) {
      setCurrentAction(queuedSubsteps[0]);
      setQueuedSubsteps(prev => prev.slice(1));
      setAssistError("");
      setStatusText(queuedSubsteps.length > 1 ? "Still just this one." : "Good. Back to the main step.");
      return;
    }
    onDone();
  };

  return (
    <div className={`exec-card exec-card--${animState}`}>
      <div className="exec-step-label">
        {isIntro ? "Start" : `Step ${stepNum} of ${totalSteps}`}
      </div>

      <div className="exec-action">{currentAction}</div>
      <p className="exec-support">{statusText}</p>
      {!!assistError && <p className="exec-support exec-support--error">{assistError}</p>}

      <div className="exec-actions">
        <button className="exec-done-btn" onClick={handleDone} disabled={animState !== "visible" || assistState !== "idle"}>
          {isIntro ? "Start" : "Done"}
        </button>
        <button className="exec-secondary-btn" onClick={() => requestSmallerStep("too-big")} disabled={animState !== "visible" || assistState !== "idle"}>
          {assistState === "too-big" ? "Making it smaller..." : "Too big"}
        </button>
        <button className="exec-secondary-btn" onClick={() => requestSmallerStep("stuck")} disabled={animState !== "visible" || assistState !== "idle"}>
          {assistState === "stuck" ? "Finding the first move..." : "Still stuck"}
        </button>
      </div>
    </div>
  );
}

function SoftSavePromptCard({ onSave, onDismiss }) {
  return (
    <div className="capture-card capture-card--soft-prompt">
      <p className="capture-headline">You&apos;re moving. Want to save your progress for later?</p>
      <div className="capture-prompt-actions">
        <button className="capture-submit" type="button" onClick={onSave}>
          Save my progress
        </button>
        <button className="capture-dismiss" type="button" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

function CaptureCard({ onSubmitted }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | sent | error

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || status === "loading") return;

    setStatus("loading");
    try {
      const res = await fetch(`${API_URL}/capture-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      localStorage.setItem(CAPTURE_SUBMITTED_KEY, "1");
      setStatus("sent");
      setTimeout(onSubmitted, 500);
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="capture-card capture-card--sent">
        <p className="capture-sent-msg">Saved. You can come back anytime.</p>
      </div>
    );
  }

  return (
    <div className="capture-card">
      <p className="capture-headline">Save your progress</p>
      <form className="capture-form" onSubmit={handleSubmit}>
        <input
          className="capture-input"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          disabled={status === "loading"}
          required
        />
        <button
          className="capture-submit"
          type="submit"
          disabled={status === "loading" || !email.trim()}
        >
          {status === "loading" ? "Saving..." : "Save progress"}
        </button>
      </form>
      {status === "error" && <p className="capture-error">Something went wrong. Try again.</p>}
    </div>
  );
}

function CompletionView({ task, totalSteps, onReset }) {
  useEffect(() => {
    const end = Date.now() + 2500;
    const colors = ["#4a7c59", "#a8c5a0", "#f5f3ef", "#ffd700", "#ff6b6b"];
    (function frame() {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);

  return (
    <div className="exec-complete-wrap">
      <div className="exec-complete">
        <div className="exec-complete-burst">🎉</div>
        <h2 className="exec-complete-title">You moved. That counts.</h2>
        <p className="exec-complete-task">{task}</p>
        <div className="exec-complete-stats">
          <span>{totalSteps} step{totalSteps !== 1 ? "s" : ""}. Done.</span>
        </div>
        <button className="exec-done-btn exec-done-btn--wide" onClick={onReset}>
          Start another task
        </button>
      </div>
    </div>
  );
}

export default function StepExecution({ steps, startHere, task, userEmail, taskId, user, onReset, onSignupNeeded }) {
  const [index, setIndex] = useState(-1);
  const [done, setDone] = useState(false);
  const [animState, setAnimState] = useState("visible");
  const [stepsFinished, setStepsFinished] = useState(0);
  // Added progression tracking and capture visibility state
  const [completedStepCount, setCompletedStepCount] = useState(0);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(() => localStorage.getItem(CAPTURE_SUBMITTED_KEY) === "1");

  const totalSteps = steps.length;
  const isIntro = index === -1;
  const progress = isIntro ? 0 : Math.round(((index + 1) / totalSteps) * 100);

  const current = isIntro
    ? { action: startHere, detail: null }
    : parseStep(steps[index]);

  const previewLimit = 5;
  const isGated = !user && !isIntro && index >= previewLimit;

  const transition = useCallback((nextFn, direction = "next") => {
    setAnimState(direction === "next" ? "exit-left" : "exit-right");
    setTimeout(() => {
      nextFn();
      setAnimState(direction === "next" ? "enter-right" : "enter-left");
      setTimeout(() => setAnimState("visible"), 30);
    }, 220);
  }, []);

  useEffect(() => {
    if (user) return;
    if (emailSubmitted) return;
    if (completedStepCount < 2) return;
    if (sessionStorage.getItem(CAPTURE_PROMPT_SHOWN_SESSION_KEY)) return;

    sessionStorage.setItem(CAPTURE_PROMPT_SHOWN_SESSION_KEY, "1");
    setShowSavePrompt(true);
  }, [completedStepCount, emailSubmitted, user]);

  const handleDone = useCallback(() => {
    if (isGated) { onSignupNeeded?.(); return; }

    const nextStepsFinished = isIntro ? stepsFinished : stepsFinished + 1;
    if (!isIntro) {
      setStepsFinished(nextStepsFinished);
      setCompletedStepCount((prev) => prev + 1);
    }

    const isLastStep = !isIntro && index + 1 >= totalSteps;

    if (user?.id && taskId) {
      if (isLastStep) {
        authFetch(`${API_URL}/user/task-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, stepsCompleted: nextStepsFinished, totalSteps }),
        }).catch(() => {});
      } else if (!isIntro) {
        authFetch(`${API_URL}/user/step-progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, stepsCompleted: nextStepsFinished, totalSteps }),
        }).catch(() => {});
      }
    }

    transition(() => {
      if (isLastStep) setDone(true);
      else setIndex(i => i + 1);
    }, "next");
  }, [isGated, isIntro, index, totalSteps, stepsFinished, transition, onSignupNeeded, user, taskId]);

  if (done) {
    return (
      <CompletionView
        task={task}
        totalSteps={totalSteps}
        onReset={onReset}
      />
    );
  }

  return (
    <div className="exec-shell">
      <div className="exec-task-label">{task}</div>
      <div className="exec-progress-track">
        <div className="exec-progress-fill" style={{ width: progress + "%" }} />
      </div>

      <StepCard
        key={index}
        stepNum={index + 1}
        totalSteps={totalSteps}
        action={current.action}
        detail={current.detail}
        isIntro={isIntro}
        animState={animState}
        onDone={handleDone}
        task={task}
        userEmail={userEmail}
        onLimitReached={() => {}}
      />

      {!user && !emailSubmitted && showSavePrompt && !showCaptureForm && (
        <SoftSavePromptCard
          onSave={() => setShowCaptureForm(true)}
          onDismiss={() => setShowSavePrompt(false)}
        />
      )}

      {!user && !emailSubmitted && showCaptureForm && (
        <CaptureCard
          onSubmitted={() => {
            setEmailSubmitted(true);
            setShowCaptureForm(false);
            setShowSavePrompt(false);
          }}
        />
      )}

      {isGated && (
        <p className="exec-gate-hint">
          Sign in free to continue all {totalSteps} steps
          <button className="exec-gate-btn" onClick={onSignupNeeded}>Continue</button>
        </p>
      )}
    </div>
  );
}
