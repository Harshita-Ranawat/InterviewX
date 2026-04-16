import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/http.js";

/** Editable template — replace bracketed parts before starting. */
const TOPIC_TEMPLATE = `Act as an interviewer for a [LEVEL] [ROLE] role. Emphasize [SKILL_OR_STACK], [SECOND_FOCUS], and concise follow-ups. Include one small scenario and end with feedback on clarity and depth.`;

const EXAMPLE_PROMPTS = [
  "Senior frontend — React performance, rendering patterns, and accessibility trade-offs.",
  "Mid-level backend — Python, REST APIs, PostgreSQL, and basic API design.",
  "Staff engineer — system design for a notification service at scale.",
  "Data analyst — SQL, metrics definitions, and communicating insights to stakeholders.",
  "New-grad software — data structures, one easy coding-style walkthrough, and collaboration.",
];

export default function AIInterviewPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState(TOPIC_TEMPLATE);
  const [sessionId, setSessionId] = useState(null);
  const [lines, setLines] = useState([]);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef(null);
  const sessionIdRef = useRef(null);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Web Speech API not available in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setLines((l) => [...l, { role: "you", text }]);
      setListening(false);
      const sid = sessionIdRef.current;
      if (!sid) return;
      setBusy(true);
      try {
        const { reply } = await apiFetch(`/api/ai-interview/sessions/${sid}/message`, {
          method: "POST",
          body: JSON.stringify({ text }),
        });
        setLines((l) => [...l, { role: "ai", text: reply }]);
        speak(reply);
      } catch (e) {
        setError(e.message || "LLM error");
      } finally {
        setBusy(false);
      }
    };
    rec.onerror = () => {
      setListening(false);
    };
    recognitionRef.current = rec;
  }, []);

  function speak(text) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }

  async function startSession() {
    setError("");
    setBusy(true);
    setLines([]);
    try {
      const res = await apiFetch("/api/ai-interview/sessions", {
        method: "POST",
        body: JSON.stringify({ topic }),
      });
      setSessionId(res.sessionId);
      setLines([{ role: "ai", text: res.opening }]);
      speak(res.opening);
    } catch (e) {
      setError(e.message || "Could not start");
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    setError("");
    if (!sessionId) {
      setError("Start a session first.");
      return;
    }
    if (!recognitionRef.current) return;
    setListening(true);
    recognitionRef.current.start();
  }

  async function finish() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const { report } = await apiFetch(`/api/ai-interview/sessions/${sessionId}/complete`, {
        method: "POST",
      });
      navigate(`/reports#${report._id}`);
    } catch (e) {
      setError(e.message || "Could not complete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">AI mock interview</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Uses the browser for speech capture and playback, OpenAI on the server for interviewer logic,
          and generates a structured report when you finish.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900/50 p-5 space-y-4 shadow-sm dark:shadow-none">
        <div>
          <label className="text-xs text-slate-600 dark:text-slate-400">Topic / role focus</label>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white resize-y min-h-[5.5rem]"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={!!sessionId}
            placeholder="Describe role, level, and what you want assessed…"
          />
          {!sessionId && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Quick starts</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 dark:border-white/15 px-3 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
                  onClick={() => setTopic(TOPIC_TEMPLATE)}
                >
                  Reset placeholder template
                </button>
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="rounded-full border border-slate-200 dark:border-white/15 px-3 py-1 text-xs text-left max-w-full text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 truncate"
                    title={ex}
                    onClick={() => setTopic(ex)}
                  >
                    {ex.length > 52 ? `${ex.slice(0, 52)}…` : ex}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Tip: name the seniority, stack, and 1–2 themes (e.g. ownership, debugging, system design). Specific prompts yield more useful reports.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!sessionId ? (
            <button
              type="button"
              disabled={busy}
              onClick={startSession}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dim disabled:opacity-50"
            >
              Start session
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={startListening}
                disabled={listening || busy}
                className="rounded-lg bg-slate-200 dark:bg-white/10 px-4 py-2 text-sm text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-white/20 disabled:opacity-50"
              >
                {listening ? "Listening…" : "Speak answer"}
              </button>
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="rounded-lg border border-slate-200 dark:border-white/15 px-4 py-2 text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
              >
                End & generate report
              </button>
            </>
          )}
        </div>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 p-4 min-h-[200px] space-y-3">
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">Transcript appears here.</p>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              className={`text-sm ${l.role === "ai" ? "text-indigo-700 dark:text-indigo-200" : "text-slate-800 dark:text-slate-100"}`}
            >
              <span className="text-xs uppercase text-slate-500 mr-2">{l.role === "ai" ? "AI" : "You"}</span>
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
