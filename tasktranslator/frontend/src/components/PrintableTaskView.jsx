function parseStep(s) {
  return {
    action: typeof s === "string" ? s : s?.action || "",
    detail: typeof s === "object" ? s?.detail || null : null,
  };
}

export default function PrintableTaskView({ task, steps, startHere }) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="print-view">

      {/* Header */}
      <div className="print-header">
        <div className="print-logo">FocusStep</div>
        <div className="print-date">{today}</div>
      </div>

      {/* Task title */}
      <h1 className="print-title">{task}</h1>
      <p className="print-subtitle">Small steps you can work through one at a time.</p>

      {/* Start here */}
      {startHere && (
        <div className="print-start-here">
          <span className="print-start-label">Start here</span>
          <span className="print-start-text">{startHere}</span>
        </div>
      )}

      {/* Steps checklist */}
      <ol className="print-steps">
        {steps.map((s, i) => {
          const { action, detail } = parseStep(s);
          return (
            <li key={i} className="print-step">
              <div className="print-step-row">
                <div className="print-checkbox" aria-hidden="true" />
                <div className="print-step-content">
                  <div className="print-step-action">{action}</div>
                  {detail && <div className="print-step-detail">{detail}</div>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Notes section */}
      <div className="print-notes-section">
        <div className="print-notes-label">Notes</div>
        <div className="print-notes-lines">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="print-notes-line" />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="print-footer">
        Printed from FocusStep — focusstepadhd.com
      </div>

    </div>
  );
}
