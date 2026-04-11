import { useState } from "react";
import supabase from "../lib/supabase";

export default function AuthModal({ onClose, onSuccess, reason }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError("Google sign-in failed. Try email instead."); setLoading(false); }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setError("Couldn't send link. Check the email and try again.");
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  const reasons = {
    save: { headline: "Save your plan", sub: "Pick up where you left off on any device." },
    start: { headline: "Continue step by step", sub: "Start Mode shows one step at a time so you never lose your place." },
    limit: { headline: "Keep going", sub: "Create a free account to continue translating tasks today." },
    default: { headline: "Save your progress", sub: "Free account. No card needed." },
  };

  const copy = reasons[reason] || reasons.default;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        {sent ? (
          <div className="auth-sent">
            <div className="auth-sent-icon">✉️</div>
            <h2>Check your email</h2>
            <p>We sent a link to <strong>{email}</strong>.<br />Click it to sign in — no password needed.</p>
          </div>
        ) : (
          <>
            <h2 className="auth-headline">{copy.headline}</h2>
            <p className="auth-sub">{copy.sub}</p>

            <button className="google-btn" onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="auth-divider"><span>or</span></div>

            <div className="auth-email-row">
              <input
                type="email"
                className="auth-email-input"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                disabled={loading}
              />
              <button className="auth-send-btn" onClick={handleMagicLink} disabled={loading || !email.trim()}>
                {loading ? "Sending…" : "Send link"}
              </button>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <p className="auth-fine-print">Free account · No card needed · Unsubscribe anytime</p>
          </>
        )}
      </div>
    </div>
  );
}
