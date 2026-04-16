import { useEffect, useState } from "react";
import { apiFetch } from "../api/http.js";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/api/ai-interview/reports");
        setReports(data);
        const hash = window.location.hash?.replace("#", "");
        if (hash) {
          const found = data.find((r) => r._id === hash);
          if (found) setSelected(found);
        }
      } catch (e) {
        setError(e.message || "Failed to load");
      }
    })();
  }, []);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-3">
        <h1 className="font-display text-2xl text-slate-900 dark:text-white">AI reports</h1>
        <p className="text-xs text-slate-500">Generated after each completed mock interview.</p>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r._id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${
                  selected?._id === r._id
                    ? "border-accent bg-accent/10 text-slate-900 dark:text-white"
                    : "border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="font-medium truncate">{r.topic}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Score {r.overallScore ?? "—"} · {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-2">
        {!selected ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-sm text-slate-500">
            Select a report to view strengths, gaps, and recommendations.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900/50 p-6 space-y-5 shadow-sm dark:shadow-none">
            <div>
              <h2 className="font-display text-xl text-slate-900 dark:text-white">{selected.topic}</h2>
              <p className="text-xs text-slate-500 mt-1">Overall {selected.overallScore ?? "—"} / 10</p>
            </div>
            <section>
              <h3 className="text-xs uppercase tracking-wide text-slate-500">Summary</h3>
              <p className="text-sm text-slate-700 dark:text-slate-200 mt-2 whitespace-pre-wrap">{selected.summary}</p>
            </section>
            <div className="grid md:grid-cols-2 gap-4">
              <section>
                <h3 className="text-xs uppercase tracking-wide text-emerald-400">Strengths</h3>
                <ul className="mt-2 text-sm text-slate-700 dark:text-slate-200 list-disc pl-4 space-y-1">
                  {(selected.strengths || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="text-xs uppercase tracking-wide text-amber-300">Improve</h3>
                <ul className="mt-2 text-sm text-slate-700 dark:text-slate-200 list-disc pl-4 space-y-1">
                  {(selected.improvements || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            </div>
            {selected.sampleBetterAnswers?.length > 0 && (
              <section>
                <h3 className="text-xs uppercase tracking-wide text-slate-500">Sample framing</h3>
                <ul className="mt-2 text-sm text-slate-700 dark:text-slate-200 list-decimal pl-4 space-y-2">
                  {selected.sampleBetterAnswers.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            )}
            {selected.scores && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
                {Object.entries(selected.scores)
                  .filter(([k]) => !["_id", "__v", "id"].includes(k))
                  .map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/5 py-2">
                    <div className="text-slate-500 capitalize">{k}</div>
                    <div className="text-lg text-slate-900 dark:text-white mt-1">{v}</div>
                  </div>
                ))}
              </section>
            )}
            <section>
              <h3 className="text-xs uppercase tracking-wide text-slate-500">Recommendations</h3>
              <p className="text-sm text-slate-700 dark:text-slate-200 mt-2 whitespace-pre-wrap">{selected.recommendations}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
