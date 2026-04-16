import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/http.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, recent] = await Promise.all([
          apiFetch("/api/interviews/dashboard-stats"),
          apiFetch("/api/ai-interview/sessions"),
        ]);
        if (!cancelled) {
          setStats(s);
          setSessions(recent.slice(0, 5));
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Could not load dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
          Hello, {profile?.displayName || profile?.email?.split("@")[0] || "there"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Track interviews, join live rooms, and review AI practice outcomes from one place.
        </p>
      </div>

      {err && <p className="text-sm text-rose-600 dark:text-rose-400">{err}</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Interviews", value: stats?.total ?? "—", hint: "you host or attend" },
          { label: "Upcoming", value: stats?.upcoming ?? "—", hint: "scheduled ahead" },
          { label: "Hosted by you", value: stats?.hosted ?? "—", hint: "rooms you own" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 hover:border-accent/40 transition shadow-sm dark:shadow-none"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{c.value}</div>
            <div className="text-xs text-slate-500 mt-1">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900/40 p-5 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-slate-900 dark:text-white">Quick actions</h2>
          </div>
          <div className="space-y-3">
            <Link
              to="/interviews"
              className="block rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Schedule or manage interviews →
            </Link>
            <Link
              to="/ai-interview"
              className="block rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Start AI mock interview (speech) →
            </Link>
            <Link
              to="/reports"
              className="block rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              Open AI performance reports →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900/40 p-5 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-slate-900 dark:text-white">Recent AI sessions</h2>
            <Link to="/reports" className="text-xs text-accent hover:underline">
              All reports
            </Link>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">No AI sessions yet. Try a mock interview.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sessions.map((s) => (
                <li
                  key={s._id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-black/30 px-3 py-2 border border-slate-200 dark:border-white/5"
                >
                  <span className="text-slate-800 dark:text-slate-200 truncate pr-2">{s.topic}</span>
                  <span className="text-xs text-slate-500 shrink-0">{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
