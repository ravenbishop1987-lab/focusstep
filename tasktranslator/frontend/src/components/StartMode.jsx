import { useState } from "react";

function speakText(text) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export default function StartMode({ steps, startHere, task, onClose, onSignupNeeded }) {
  // Index -1 = "start here" card
  const [index, setIndex] = useState(-1);
  const [done, setDone] = useState(false);

  const isPreview = !onSignupNeeded; // if onSignupNeeded passed → user is anonymous
  const previewLimit = 2; // anon users see step 0 and 1 (after startHere)

  const totalSteps = steps.length;
  const progress = index === -1 ? 0 : Math.round(((index + 1) / totalSteps) * 100);

  const current = index === -1
    ? { action: "Start Here", detail: startHere }
    : { action: steps[index]?.action || steps[index], detail: steps[index]?.detail || null };

  const handleNext = () => {
    // Gate anonymous users after preview
    if (onSignupNeeded && index + 1 >= previewLimit) {
      onSignupNeeded();
      return;
    }
    if (index + 1 >= totalSteps) {
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  };

  const handlePrev = () => {
    if (index > -1) setIndex(i => i - 1);
  };

  return (
    <div className="startmode-backdrop">
      <div className="startmode-shell">

        <div className="startmode-top">
          <button className="startmode-exit" onClick={() => { window.speechSynthesis.cancel(); onClose(); }}>✕ Exit</button>
          <div className="startmode-task-label">{task}</div>
        </div>

        {!done ? (
          <>
            <div className="startmode-progress-bar">
              <div className="startmode-progress-fill" style={{ width: progress + "%" }} />
            </div>
            <div className="startmode-step-counter">
              {index === -1 ? "Before you begin" : `Step ${index + 1} of ${totalSteps}`}
            </div>

            <div className="startmode-card">
              <div className="startmode-action">{current.action}</div>
              {current.detail && <div className="startmode-detail">{current.detail}</div>}
              <button
                className="startmode-speak"
                onClick={() => speakText(current.action + (current.detail ? ". " + current.detail : ""))}
              >
                🔊 Read aloud
              </button>
            </div>

            <div className="startmode-nav">
              {index > -1 && (
                <button className="startmode-prev" onClick={handlePrev}>← Back</button>
              )}
              <button className="startmode-done-btn" onClick={handleNext}>
                {index + 1 >= totalSteps ? "Finish ✓" : "Done →"}
              </button>
            </div>

            {onSignupNeeded && index + 1 >= previewLimit && (
              <p className="startmode-gate-hint">Create a free account to continue all {totalSteps} steps</p>
            )}
          </>
        ) : (
          <div className="startmode-complete">
            <div className="startmode-complete-icon">🎉</div>
            <h2>You did it.</h2>
            <p>Task complete: <strong>{task}</strong></p>
            <button className="startmode-done-btn" onClick={onClose}>Back to tasks</button>
          </div>
        )}

      </div>
    </div>
  );
}
