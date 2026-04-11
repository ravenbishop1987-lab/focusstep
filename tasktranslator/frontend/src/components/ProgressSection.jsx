import { useState, useEffect } from "react";
import StatCard from "./StatCard";
import { authFetch } from "../lib/api";

const API_URL = import.meta.env.VITE_API_URL || "";

const MESSAGES = [
  "Small steps are adding up.",
  "You're making progress.",
  "Every task counts.",
  "You showed up. That matters.",
  "One step at a time.",
];

function encouragement(tasksThisWeek, streak) {
  if (streak >= 7) return "A full week of showing up. Keep going.";
  if (streak >= 3) return `${streak} days in a row. That's momentum.`;
  if (tasksThisWeek >= 5) return "You're on a roll this week.";
  if (tasksThisWeek >= 1) return "You're making progress.";
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return n.toString();
}

export default function ProgressSection({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    authFetch(`${API_URL}/user/progress`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="progress-section progress-section--locked">
        <p>Sign in to track your progress.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="progress-section progress-loading">Loading your progress…</div>;
  }

  const s = stats || { tasksThisWeek: 0, tasksToday: 0, stepsToday: 0, completionRate: 0, streak: 0 };

  const msg = encouragement(s.tasksThisWeek, s.streak);

  return (
    <div className="progress-section">

      <div className="progress-header">
        <h2 className="progress-title">Your Progress</h2>
        <p className="progress-msg">{msg}</p>
      </div>

      <div className="progress-grid">
        <StatCard
          value={fmt(s.tasksThisWeek)}
          label="Tasks this week"
          sub="last 7 days"
        />
        <StatCard
          value={fmt(s.stepsToday)}
          label="Steps today"
        />
        <StatCard
          value={`${fmt(s.completionRate)}%`}
          label="Completion rate"
          sub="tasks finished vs started"
          accent
        />
        {s.streak > 0 && (
          <StatCard
            value={`${fmt(s.streak)}d`}
            label="Day streak"
            sub={s.streak === 1 ? "started today" : "days in a row"}
          />
        )}
      </div>

      {s.tasksThisWeek === 0 && s.stepsToday === 0 && (
        <p className="progress-empty">
          Complete your first task to start tracking progress.
        </p>
      )}

    </div>
  );
}
