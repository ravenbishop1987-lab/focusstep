import { useEffect, useState } from "react";

export default function Success({ onContinue }) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length < 3 ? d + "." : "."), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="success-page">
      <div className="success-card">
        <div className="success-icon">◎</div>
        <h1>You're all set.</h1>
        <p>
          Pro access is now active. No daily limits. Break down as many tasks as you need.
        </p>
        <p className="success-sub">
          A confirmation email is on its way{dots}
        </p>
        <button className="translate-btn" onClick={onContinue} style={{ marginTop: 24 }}>
          Start Breaking Tasks Down
        </button>
      </div>
    </div>
  );
}

