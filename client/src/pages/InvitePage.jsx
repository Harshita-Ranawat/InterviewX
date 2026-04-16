import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiFetch } from "../api/http.js";

export default function InvitePage() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState("working");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    (async () => {
      try {
        await apiFetch("/api/interviews/invite/accept", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        setStatus("ok");
      } catch (e) {
        setStatus("err");
        setMsg(e.message || "Could not accept invite");
      }
    })();
  }, [loading, user, token]);

  if (!loading && !user) {
    try {
      sessionStorage.setItem("postAuthRedirect", `/invite/${token}`);
    } catch {
      /* ignore */
    }
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-ink-950">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900/60 p-8 text-center shadow-lg dark:shadow-none">
        {status === "working" && <p className="text-slate-600 dark:text-slate-300">Accepting invitation…</p>}
        {status === "ok" && (
          <>
            <h1 className="font-display text-xl text-slate-900 dark:text-white">You are in</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">The interview is on your dashboard.</p>
            <Link to="/interviews" className="inline-block mt-6 text-accent text-sm hover:underline">
              Go to interviews
            </Link>
          </>
        )}
        {status === "err" && (
          <>
            <h1 className="font-display text-xl text-rose-400">Invite issue</h1>
            <p className="text-sm text-slate-400 mt-2">{msg}</p>
            <Link to="/" className="inline-block mt-6 text-accent text-sm hover:underline">
              Back home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
