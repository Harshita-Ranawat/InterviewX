import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/http.js";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Google redirects here with ?code=&state=. We exchange the code on the API and store the refresh token.
 */
export default function GmailInviteCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [message, setMessage] = useState("Connecting your Gmail…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    const code = params.get("code");
    const state = params.get("state");
    const err = params.get("error");
    const errDesc = params.get("error_description");

    if (err) {
      setMessage(errDesc || err || "Google sign-in was cancelled.");
      return;
    }
    if (!code || !state) {
      setMessage("Missing authorization code. Open Invite mail and try Connect Gmail again.");
      return;
    }

    ran.current = true;
    let cancelled = false;
    (async () => {
      try {
        await apiFetch("/api/auth/gmail-invite/complete", {
          method: "POST",
          body: JSON.stringify({ code, state }),
        });
        if (cancelled) return;
        await refreshProfile();
        navigate("/settings/mail?gmail=connected", { replace: true });
      } catch (e) {
        ran.current = false;
        if (!cancelled) setMessage(e.message || "Could not finish Gmail setup.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, navigate, refreshProfile]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center max-w-md">{message}</p>
    </div>
  );
}
