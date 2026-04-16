import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/http.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function InterviewsPage() {
  const { profile } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFor, setInviteFor] = useState(null);
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [inviteEmailNotice, setInviteEmailNotice] = useState("");
  const [interviewFormat, setInterviewFormat] = useState("coding");

  async function refresh() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/interviews");
      setList(data);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    try {
      await apiFetch("/api/interviews", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          scheduledAt: new Date(scheduledAt).toISOString(),
          interviewFormat,
        }),
      });
      setTitle("");
      setDescription("");
      setScheduledAt("");
      setInterviewFormat("coding");
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err.message || "Create failed");
    }
  }

  async function sendInvite(id) {
    if (!inviteEmail) return;
    setInviteEmailNotice("");
    try {
      const res = await apiFetch(`/api/interviews/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail }),
      });
      const token = res?.invite?.token;
      if (token) {
        setLastInviteUrl(`${window.location.origin}/invite/${token}`);
      }
      const d = res?.emailDelivery;
      if (d?.sent) {
        if (d?.usedFallback) {
          setInviteEmailNotice(
            `Invite email sent to ${inviteEmail.trim()} (using the server’s optional fallback SMTP). Add your own under Settings → Invite mail to send from your address.`
          );
        } else if (d?.via === "gmail") {
          setInviteEmailNotice(`Invite email sent to ${inviteEmail.trim()} from your Gmail.`);
        } else {
          setInviteEmailNotice(`Invite email sent to ${inviteEmail.trim()}.`);
        }
      } else if (d?.skipReason) {
        setInviteEmailNotice(
          `Invite saved; email not sent (${d.skipReason}). Copy the link below or configure Settings → Invite mail (SMTP).`
        );
      } else if (d?.error) {
        setInviteEmailNotice(
          `Invite saved, but the email provider returned an error: ${d.error}. You can still share the link below.`
        );
      }
      setInviteFor(null);
      setInviteEmail("");
      await refresh();
    } catch (e) {
      setError(e.message || "Invite failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">Interviews</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Organize sessions, share room codes, and invite participants by email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dim w-fit"
        >
          {showForm ? "Close form" : "New interview"}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {profile && !profile.inviteMailReady && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          To email invites <strong>from your mailbox</strong>, open{" "}
          <Link to="/settings/mail" className="font-medium text-accent hover:underline">
            Invite mail
          </Link>{" "}
          and use <strong>Connect Gmail</strong> or save SMTP details. Until then, you can still copy the invite link
          after sending.
        </div>
      )}
      {inviteEmailNotice && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            inviteEmailNotice.startsWith("Invite email sent")
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100"
              : "bg-amber-50 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100"
          }`}
        >
          {inviteEmailNotice}
        </p>
      )}
      {lastInviteUrl && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-xs text-emerald-900 dark:text-emerald-100">
          <div className="font-medium text-emerald-800 dark:text-emerald-200">Invite link (share with guest)</div>
          <div className="mt-1 break-all font-mono text-[11px]">{lastInviteUrl}</div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={onCreate}
          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900/50 p-5 space-y-4 max-w-xl shadow-sm dark:shadow-none"
        >
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400">Title</label>
            <input
              className="mt-1 w-full rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400">Description</label>
            <textarea
              className="mt-1 w-full rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm min-h-[80px] text-slate-900 dark:text-white"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400">Scheduled time</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-white"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-xs text-slate-600 dark:text-slate-400">Interview type</legend>
            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="radio"
                name="fmt"
                checked={interviewFormat === "coding"}
                onChange={() => setInterviewFormat("coding")}
              />
              Coding — live editor, run test cases, timer
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="radio"
                name="fmt"
                checked={interviewFormat === "face_to_face"}
                onChange={() => setInterviewFormat("face_to_face")}
              />
              Face-to-face — video only (no editor)
            </label>
          </fieldset>
          <button
            type="submit"
            className="rounded-lg bg-white text-ink-950 px-4 py-2 text-sm font-semibold hover:bg-slate-200"
          >
            Create interview
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : (
        <div className="space-y-3">
          {list.map((iv) => (
            <div
              key={iv._id}
              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm dark:shadow-none"
            >
              <div>
                <div className="font-medium text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  {iv.title}
                  <span
                    className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold ${
                      iv.interviewFormat === "face_to_face"
                        ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200"
                        : "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200"
                    }`}
                  >
                    {iv.interviewFormat === "face_to_face" ? "Face-to-face" : "Coding"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(iv.scheduledAt).toLocaleString()} · Room{" "}
                  <span className="text-accent font-mono">{iv.roomCode}</span> · {iv.status}
                </div>
                {iv.description && <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{iv.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/room/${iv.roomCode}`}
                  className="rounded-lg border border-slate-200 dark:border-white/15 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Open live room
                </Link>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 dark:border-white/15 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                  onClick={() => setInviteFor(iv._id)}
                >
                  Invite by email
                </button>
              </div>
              {inviteFor === iv._id && (
                <div className="w-full md:w-auto flex gap-2 items-center">
                  <input
                    placeholder="email@company.com"
                    className="flex-1 rounded-lg bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => sendInvite(iv._id)}
                    className="rounded-lg bg-accent px-3 py-2 text-xs text-white"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && !loading && (
            <p className="text-slate-500 text-sm">No interviews yet. Create one to get a room code.</p>
          )}
        </div>
      )}
    </div>
  );
}
