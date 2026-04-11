import { useState } from "react";

function TasksIcon({ active }) {
  const w = active ? 2.2 : 1.7;
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function DashboardIcon({ active }) {
  const w = active ? 2.2 : 1.7;
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ProgressIcon({ active }) {
  const w = active ? 2.2 : 1.7;
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function AccountIcon({ active }) {
  const w = active ? 2.2 : 1.7;
  return (
    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const TABS = [
  { id: "app",       label: "Tasks",     Icon: TasksIcon },
  { id: "dashboard", label: "Dashboard", Icon: DashboardIcon },
  { id: "progress",  label: "Progress",  Icon: ProgressIcon },
  { id: "account",   label: "Account",   Icon: AccountIcon },
];

export default function BottomTabBar({ activeView, onNavigate }) {
  const [tapped, setTapped] = useState(null);

  const handleTap = (tabId) => {
    setTapped(tabId);
    onNavigate(tabId);
    // Clear tapped class after animation completes
    setTimeout(() => setTapped((prev) => (prev === tabId ? null : prev)), 250);
  };

  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeView === id;
        const isTapped = tapped === id;
        return (
          <button
            key={id}
            className={[
              "tab-item",
              isActive ? "tab-item--active" : "",
              isTapped ? "tab-item--tapped" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => handleTap(id)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="tab-icon-wrap">
              <Icon active={isActive} />
            </span>
            <span className="tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
