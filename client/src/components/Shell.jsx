import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const linkClass = ({ isActive }) =>
  `block w-full rounded-lg px-3 py-2 text-sm font-medium transition text-left ${
    isActive
      ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"
      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
  }`;

export default function Shell() {
  const { profile, logout } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function confirmLogout() {
    setConfirmSignOut(false);
    await logout();
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-ink-950">
      {confirmSignOut && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-title"
          onClick={() => setConfirmSignOut(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="signout-title" className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Sign out?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Are you sure you want to sign out?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSignOut(false)}
                className="rounded-lg border border-slate-200 dark:border-white/15 px-4 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-slate-200 dark:border-white/10 bg-white/90 dark:bg-ink-900/80 backdrop-blur">
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Interview<span className="text-accent">OS</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Schedule · Code · AI practice</p>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>
        <nav className="flex flex-1 flex-col p-3 space-y-1 overflow-y-auto">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/interviews" className={linkClass}>
            Interviews
          </NavLink>
          <NavLink to="/ai-interview" className={linkClass}>
            AI Mock Interview
          </NavLink>
          <NavLink to="/reports" className={linkClass}>
            AI Reports
          </NavLink>
          <NavLink to="/settings/mail" className={linkClass}>
            Invite mail (SMTP)
          </NavLink>
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-500">
          <div className="text-slate-800 dark:text-slate-300 font-medium truncate">{profile?.displayName || "User"}</div>
          <div className="truncate">{profile?.email}</div>
          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            className="mt-3 w-full rounded-lg border border-slate-200 dark:border-white/10 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/90">
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            <span className="font-display font-semibold text-slate-900 dark:text-white">InterviewOS</span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="text-sm text-slate-600 dark:text-slate-400"
              >
                Out
              </button>
            </div>
          </div>
          <nav className="flex flex-col gap-1 px-3 pb-3">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <NavLink to="/interviews" className={linkClass}>
              Interviews
            </NavLink>
            <NavLink to="/ai-interview" className={linkClass}>
              AI Mock Interview
            </NavLink>
            <NavLink to="/reports" className={linkClass}>
              Reports
            </NavLink>
            <NavLink to="/settings/mail" className={linkClass}>
              Invite mail
            </NavLink>
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full text-slate-800 dark:text-slate-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
