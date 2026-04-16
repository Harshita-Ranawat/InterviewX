import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 dark:from-ink-950 dark:to-ink-900 text-slate-900 dark:text-white">
      <header className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between gap-3">
        <span className="font-display font-semibold text-lg">
          Interview<span className="text-accent">OS</span>
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to={user ? "/" : "/login"}
            className="rounded-full bg-slate-200 dark:bg-white/10 px-4 py-2 text-sm text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-white/20"
          >
            {user ? "Open dashboard" : "Sign in"}
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 pb-24">
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight mt-8">
          Human interviews, live coding, and AI mock sessions — unified.
        </h1>
        <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
          Schedule real interviews with invites, collaborate in a shared Monaco workspace over Socket.io,
          and practice with a speech-based AI interviewer. Reports are generated automatically from your
          session transcript.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            to="/login"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-dim transition"
          >
            Get started
          </Link>
          <a
            href="#stack"
            className="rounded-xl border border-slate-300 dark:border-white/15 px-6 py-3 text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            View stack
          </a>
        </div>
        <section id="stack" className="mt-20 grid md:grid-cols-3 gap-6 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-white/80 dark:bg-white/5">
            <h3 className="font-display text-slate-900 dark:text-white mb-2">Speech & AI</h3>
            Web Speech API, OpenAI, and browser TTS — no paid STT/TTS required for the baseline flow.
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-white/80 dark:bg-white/5">
            <h3 className="font-display text-slate-900 dark:text-white mb-2">Realtime coding</h3>
            Monaco Editor with Socket.io broadcast rooms, plus Firestore hooks for presence metadata.
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-white/80 dark:bg-white/5">
            <h3 className="font-display text-slate-900 dark:text-white mb-2">Data plane</h3>
            MongoDB for interviews and reports, Firebase Auth/Storage, Firestore for lightweight signals.
          </div>
        </section>
      </main>
    </div>
  );
}
