import { useState, useEffect, useCallback, useRef } from "react";
import Translator from "./components/Translator";
import Pricing from "./components/Pricing";
import Success from "./components/Success";
import AuthModal from "./components/AuthModal";
import AdminApp from "./admin/AdminApp";
import ReferralCard from "./components/ReferralCard";
import ProgressSection from "./components/ProgressSection";
import TaskSharePublicPage from "./components/TaskSharePublicPage";
import UserDashboard from "./components/UserDashboard";
import supabase from "./lib/supabase";
import { authFetch } from "./lib/api";
import "./App.css";

const MAX_HISTORY = 50;
const API_URL = import.meta.env.VITE_API_URL || "";
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// Capture referral code from URL once on load and track the click
const pendingRef = (() => {
  const p = new URLSearchParams(window.location.search).get("ref");
  if (p) {
    window.history.replaceState({}, "", window.location.pathname);
    fetch(`${import.meta.env.VITE_API_URL || ""}/referral/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: p }),
    }).catch(() => {});
  }
  return p;
})();

function getAnalyticsSessionId() {
  const key = "focusstep_analytics_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(key, next);
  return next;
}

export default function App() {
  const PERSIST_VIEWS = new Set(["app", "pricing", "dashboard", "progress"]);
  const [view, setView] = useState(() => {
    const hash = { "#pricing": "pricing", "#dashboard": "dashboard", "#progress": "progress" };
    return hash[window.location.hash] || localStorage.getItem("focusstep_view") || "app";
  });

  const navigateTo = useCallback((v) => {
    setView(v);
    if (PERSIST_VIEWS.has(v)) localStorage.setItem("focusstep_view", v);
  }, []);
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(() => localStorage.getItem("focusstep_is_pro") === "true");
  const [authModal, setAuthModal] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [subView, setSubView] = useState("translate");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [plan, setPlan] = useState(null);
  const [capturedEmail, setCapturedEmail] = useState(() => localStorage.getItem("focusstep_captured_email") || "");
  const referralAttached = useRef(false);
  const accountMenuRef = useRef(null);
  const touchStartX = useRef(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const isAdmin = !!user && ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(user.email?.toLowerCase());

  // ── Load tasks from Supabase (logged in) or localStorage (anon) ──
  const loadUserData = useCallback(async (uid) => {
    if (!uid) {
      // Anonymous — use localStorage
      try {
        setHistory(JSON.parse(localStorage.getItem("focusstep_history") || "[]"));
        setFavorites(JSON.parse(localStorage.getItem("focusstep_favorites") || "[]"));
      } catch { setHistory([]); setFavorites([]); }
      setDataLoaded(true);
      return;
    }
    // Logged in — load from Supabase
    const { data, error } = await supabase
      .from("user_tasks")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY);

    if (!error && data) {
      const all = data.map(r => ({ id: r.id, task: r.task, result: r.result, date: new Date(r.created_at).toLocaleDateString(), isFav: r.is_favorite }));
      setHistory(all);
      setFavorites(all.filter(r => r.isFav));
    }
    setDataLoaded(true);
  }, []);

  // ── Attach pending referral code after sign-in ───────────────────
  const attachReferral = useCallback(async (email) => {
    if (!pendingRef || !email || referralAttached.current) return;
    referralAttached.current = true;
    try {
      await fetch(`${API_URL}/referral/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: pendingRef }),
      });
    } catch { /* non-critical */ }
  }, []);

  // ── Auth listener ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user || null;
      setUser(u);
      if (u?.email) checkProStatus(u.email);
      loadUserData(u?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) return;
      const u = session?.user || null;
      setUser(u);
      if (u?.email) {
        checkProStatus(u.email);
        if (event === 'SIGNED_IN') attachReferral(u.email);
      }
      loadUserData(u?.id || null);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData, attachReferral]);

  // ── Pro status ───────────────────────────────────────────────────
  const checkProStatus = (email) => {
    if (!email) return;
    authFetch(`${API_URL}/pro-status`)
      .then(r => r.json())
      .then(d => {
        const pro = d.isPro || false;
        setIsPro(pro);
        setPlan(d.plan || null);
        localStorage.setItem("focusstep_is_pro", pro);
      })
      .catch(() => {});
  };

  // ── Routing ──────────────────────────────────────────────────────
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/success" || window.location.search.includes("session_id")) {
      setView("success"); window.history.replaceState({}, "", "/");
    } else if (path.startsWith('/admin')) {
      setView('admin');
    } else if (window.location.hash === "#pricing") {
      setView("pricing"); window.history.replaceState({}, "", "/");
    } else if (path.startsWith("/task-share/")) {
      setView("task-share-public");
      // keep URL so the share page can read the code from window.location.pathname
    } else if (path === "/join") {
      setView("pricing"); window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (view !== "app") return;
    const path = window.location.pathname || "/";
    if (path !== "/") return;
    const alreadyTracked = sessionStorage.getItem("focusstep_translator_home_viewed");
    if (alreadyTracked) return;
    sessionStorage.setItem("focusstep_translator_home_viewed", "1");

    const params = new URLSearchParams(window.location.search);
    fetch(`${API_URL}/analytics/page-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageKey: "translator_home",
        path,
        sessionId: getAnalyticsSessionId(),
        userId: user?.id || null,
        userEmail: user?.email || null,
        referrer: document.referrer || "",
        utmSource: params.get("utm_source"),
        utmMedium: params.get("utm_medium"),
        utmCampaign: params.get("utm_campaign"),
      }),
    }).catch(() => {});
  }, [view, user]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  // ── Add to history ───────────────────────────────────────────────
  const addToHistory = async (task, result) => {
    if (user) {
      const { data, error } = await supabase.from("user_tasks").insert({
        user_id: user.id, task, result, is_favorite: false
      }).select().single();
      if (!error && data) {
        const entry = { id: data.id, task, result, date: new Date(data.created_at).toLocaleDateString(), isFav: false };
        setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
        return entry; // return so Translator can capture taskId
      }
    } else {
      const entry = { id: Date.now(), task, result, date: new Date().toLocaleDateString() };
      const updated = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(updated);
      localStorage.setItem("focusstep_history", JSON.stringify(updated));
    }
  };

  // ── Toggle favorite ──────────────────────────────────────────────
  const toggleFavorite = async (entry) => {
    const isFav = favorites.some(f => f.id === entry.id);
    if (user) {
      await supabase.from("user_tasks").update({ is_favorite: !isFav }).eq("id", entry.id);
      setHistory(prev => prev.map(h => h.id === entry.id ? { ...h, isFav: !isFav } : h));
      setFavorites(prev => isFav ? prev.filter(f => f.id !== entry.id) : [{ ...entry, isFav: true }, ...prev]);
    } else {
      const updated = isFav ? favorites.filter(f => f.id !== entry.id) : [entry, ...favorites];
      setFavorites(updated);
      localStorage.setItem("focusstep_favorites", JSON.stringify(updated));
    }
  };

  const isFavorited = (id) => favorites.some(f => f.id === id);

  // ── Delete ───────────────────────────────────────────────────────
  const deleteHistory = async (id) => {
    if (user) {
      await supabase.from("user_tasks").delete().eq("id", id);
    } else {
      localStorage.setItem("focusstep_history", JSON.stringify(history.filter(h => h.id !== id)));
    }
    setHistory(prev => prev.filter(h => h.id !== id));
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  const deleteFavorite = async (id) => {
    if (user) {
      await supabase.from("user_tasks").update({ is_favorite: false }).eq("id", id);
      setHistory(prev => prev.map(h => h.id === id ? { ...h, isFav: false } : h));
    } else {
      localStorage.setItem("focusstep_favorites", JSON.stringify(favorites.filter(f => f.id !== id)));
    }
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  const clearAllHistory = async () => {
    if (user) {
      await supabase.from("user_tasks").delete().eq("user_id", user.id);
    } else {
      localStorage.setItem("focusstep_history", "[]");
      localStorage.setItem("focusstep_favorites", "[]");
      setFavorites([]);
    }
    setHistory([]);
  };

  const clearAllFavorites = async () => {
    if (user) {
      await supabase.from("user_tasks").update({ is_favorite: false }).eq("user_id", user.id);
      setHistory(prev => prev.map(h => ({ ...h, isFav: false })));
    } else {
      localStorage.setItem("focusstep_favorites", "[]");
    }
    setFavorites([]);
  };

  // ── Sign out ─────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
    setUser(null);
    setIsPro(false);
    localStorage.removeItem("focusstep_is_pro");
    loadUserData(null);
  };

  const openView = (nextView) => {
    setAccountMenuOpen(false);
    navigateTo(nextView);
  };

  useEffect(() => {
    if (capturedEmail) localStorage.setItem("focusstep_captured_email", capturedEmail);
    else localStorage.removeItem("focusstep_captured_email");
  }, [capturedEmail]);

  // Public pages render without the main nav shell
  if (view === "task-share-public") {
    return (
      <TaskSharePublicPage
        user={user}
        onSignupNeeded={(reason) => setAuthModal(reason || "default")}
        onNavigate={(v) => { setView(v); window.history.replaceState({}, "", "/"); }}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="logo">
          <span className="logo-icon">◎</span>
          <span className="logo-text">Focus<em>Step</em> ADHD</span>
        </div>
        <nav className={!user && view === "app" ? "nav-hidden" : ""}>
          <button className={`nav-link ${view === "app" ? "active" : ""}`} onClick={() => navigateTo("app")}>Tasks</button>
          <button className={`nav-link ${view === "pricing" ? "active" : ""}`} onClick={() => navigateTo("pricing")}>
            {isPro ? "✓ Pro" : "Pricing"}
          </button>
          {user ? (
            <div className="nav-user-group" ref={accountMenuRef}>
              <button
                className={`nav-link ${view === "dashboard" ? "active" : ""}`}
                onClick={() => openView("dashboard")}
                aria-label="Open your dashboard"
                title="Open your dashboard"
              >
                Dashboard
              </button>
              <button
                className={`nav-menu-btn ${accountMenuOpen ? "active" : ""}`}
                onClick={() => setAccountMenuOpen((open) => !open)}
                aria-label="Open account menu"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                title="Open account menu"
              >
                More
                <span className={`nav-menu-chevron ${accountMenuOpen ? "open" : ""}`} aria-hidden="true">⌄</span>
              </button>
              {accountMenuOpen && (
                <>
                  <button
                    className="nav-menu-backdrop"
                    aria-label="Close account menu"
                    onClick={() => setAccountMenuOpen(false)}
                  />
                  <div className="nav-dropdown-menu" role="menu" aria-label="Account menu">
                    {isAdmin && (
                      <a className="nav-dropdown-item nav-dropdown-item-admin" role="menuitem" href="/admin">
                        Admin Panel
                      </a>
                    )}
                    <button className="nav-dropdown-item nav-dropdown-item-danger" role="menuitem" onClick={handleSignOut}>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="nav-link nav-signin" onClick={() => setAuthModal("default")}>Sign in</button>
          )}
        </nav>
      </header>

      <main
        className="main-with-tab-bar"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) < 60) return;
          const views = user ? ["app", "pricing", "progress", "dashboard"] : ["app", "pricing"];
          const idx = views.indexOf(view);
          if (dx < 0 && idx < views.length - 1) navigateTo(views[idx + 1]);
          if (dx > 0 && idx > 0) navigateTo(views[idx - 1]);
        }}
      >
        {view === "app" && (
          <Translator
            onUpgrade={() => navigateTo("pricing")}
            onSignupNeeded={(reason) => setAuthModal(reason || "default")}
            onLeadCaptured={(email) => setCapturedEmail(email)}
            onOpenPricing={() => navigateTo("pricing")}
            user={user}
            isPro={isPro}
            plan={plan}
            history={history}
            favorites={favorites}
            addToHistory={addToHistory}
            toggleFavorite={toggleFavorite}
            isFavorited={isFavorited}
            subView={subView}
            setSubView={setSubView}
            deleteHistory={deleteHistory}
            deleteFavorite={deleteFavorite}
            clearAllHistory={clearAllHistory}
            clearAllFavorites={clearAllFavorites}
            dataLoaded={dataLoaded}
          />
        )}
        {view === 'admin' && (
          <AdminApp />
        )}
        {view === "pricing" && (
          <Pricing onBack={() => navigateTo("app")} userEmail={user?.email || capturedEmail || ""} isPro={isPro} plan={plan} />
)}
        {view === "success" && <Success onContinue={() => navigateTo("app")} />}
        {view === "progress" && (
          <div className="progress-page">
            <div className="page-fancy-header">
              <div className="page-fancy-kicker">Keep going</div>
              <h1 className="page-fancy-title">Your Progress ⚡</h1>
              <p className="page-fancy-sub">Every task you finish is a win. Here's the proof.</p>
            </div>
            <ProgressSection user={user} />
          </div>
        )}
        {view === "dashboard" && (
          <UserDashboard
            user={user}
            isPro={isPro}
            plan={plan}
            onSignupNeeded={(reason) => setAuthModal(reason || "default")}
            onOpenPricing={() => navigateTo("pricing")}
            onOpenTranslate={() => navigateTo("app")}
          />
        )}
      </main>

      <footer className="site-footer site-footer--with-tabs">
        Made with care for ADHD minds &nbsp;·&nbsp; No hustle energy here.
      </footer>

      <nav className="bottom-tab-bar" aria-label="Main navigation">
        <button
          className={`tab-item ${view === "app" ? "tab-item--active" : ""}`}
          onClick={() => navigateTo("app")}
        >
          <span className="tab-icon-wrap">
            <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><line x1="14" y1="17" x2="21" y2="17" /><line x1="17.5" y1="14" x2="17.5" y2="21" />
            </svg>
          </span>
          <span className="tab-label">Tasks</span>
        </button>

        <button
          className={`tab-item ${view === "pricing" ? "tab-item--active" : ""}`}
          onClick={() => navigateTo("pricing")}
        >
          <span className="tab-icon-wrap">
            <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <span className="tab-label">{isPro ? "✓ Pro" : "Pricing"}</span>
        </button>

        {user && (
          <button
            className={`tab-item ${view === "progress" ? "tab-item--active" : ""}`}
            onClick={() => navigateTo("progress")}
          >
            <span className="tab-icon-wrap">
              <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </span>
            <span className="tab-label">Progress</span>
          </button>
        )}

        {user && (
          <button
            className={`tab-item ${view === "dashboard" ? "tab-item--active" : ""}`}
            onClick={() => navigateTo("dashboard")}
          >
            <span className="tab-icon-wrap">
              <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span className="tab-label">Me</span>
          </button>
        )}

        {!user && (
          <button
            className="tab-item"
            onClick={() => setAuthModal("default")}
          >
            <span className="tab-icon-wrap">
              <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </span>
            <span className="tab-label">Sign in</span>
          </button>
        )}
      </nav>

      {authModal && (
        <AuthModal reason={authModal} onClose={() => setAuthModal(null)} onSuccess={() => setAuthModal(null)} />
      )}
    </div>
  );
}
