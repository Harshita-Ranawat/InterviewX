import { useEffect, useRef, useState, useCallback } from "react";

function formatMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * Per-question countdown. Host controls; state syncs to peers via code socket.
 * state: { running, endsAt, presetSec, pausedRemainingMs }
 */
export default function QuestionTimer({ socket, roomCode, isHost }) {
  const [presetMin, setPresetMin] = useState(10);
  const [displayMs, setDisplayMs] = useState(0);
  const [running, setRunning] = useState(false);
  const endsAtRef = useRef(null);
  const pausedRemainingRef = useRef(0);
  const tickRef = useRef(null);

  const applyRemoteState = useCallback((st) => {
    if (!st) return;
    if (st.running && st.endsAt) {
      endsAtRef.current = st.endsAt;
      setRunning(true);
      setDisplayMs(Math.max(0, st.endsAt - Date.now()));
    } else {
      setRunning(false);
      endsAtRef.current = null;
      pausedRemainingRef.current = st.pausedRemainingMs ?? 0;
      setDisplayMs(st.pausedRemainingMs ?? 0);
    }
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onSync = (state) => {
      applyRemoteState(state);
    };
    socket.on("question-timer-sync", onSync);
    return () => socket.off("question-timer-sync", onSync);
  }, [socket, applyRemoteState]);

  useEffect(() => {
    if (!running || !endsAtRef.current) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return undefined;
    }
    tickRef.current = setInterval(() => {
      const left = Math.max(0, endsAtRef.current - Date.now());
      setDisplayMs(left);
      if (left <= 0) {
        setRunning(false);
        endsAtRef.current = null;
      }
    }, 250);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running]);

  const broadcast = (state) => {
    socket?.emit("question-timer-sync", { roomId: roomCode, state });
  };

  const start = () => {
    const presetSec = Math.max(1, Number(presetMin) || 1) * 60;
    const endsAt = Date.now() + presetSec * 1000;
    endsAtRef.current = endsAt;
    setRunning(true);
    setDisplayMs(presetSec * 1000);
    broadcast({ running: true, endsAt, presetSec });
  };

  const pause = () => {
    if (!endsAtRef.current) return;
    const left = Math.max(0, endsAtRef.current - Date.now());
    setRunning(false);
    endsAtRef.current = null;
    pausedRemainingRef.current = left;
    setDisplayMs(left);
    broadcast({ running: false, pausedRemainingMs: left });
  };

  const resume = () => {
    const ms = pausedRemainingRef.current || displayMs;
    if (ms <= 0) return;
    const endsAt = Date.now() + ms;
    endsAtRef.current = endsAt;
    setRunning(true);
    broadcast({ running: true, endsAt });
  };

  const reset = () => {
    setRunning(false);
    endsAtRef.current = null;
    const presetSec = Math.max(1, Number(presetMin) || 1) * 60;
    pausedRemainingRef.current = presetSec * 1000;
    setDisplayMs(presetSec * 1000);
    broadcast({ running: false, pausedRemainingMs: presetSec * 1000, presetSec });
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-ink-900/40 p-4 flex flex-wrap items-center gap-3 shadow-sm dark:shadow-none">
      <div className="font-display text-sm font-semibold text-slate-800 dark:text-white">Question timer</div>
      <div className="text-2xl font-mono tabular-nums text-slate-900 dark:text-white">{formatMs(displayMs)}</div>
      <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
        Preset (min)
        <select
          className="rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-2 py-1 text-xs text-slate-900 dark:text-white"
          value={presetMin}
          disabled={!isHost}
          onChange={(e) => setPresetMin(Number(e.target.value))}
        >
          {[3, 5, 10, 15, 20, 30].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      {isHost ? (
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <button
              type="button"
              onClick={start}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dim"
            >
              Start
            </button>
          ) : (
            <button
              type="button"
              onClick={pause}
              className="rounded-lg bg-slate-200 dark:bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
            >
              Pause
            </button>
          )}
          {!running && displayMs > 0 && (
            <button
              type="button"
              onClick={resume}
              className="rounded-lg border border-slate-200 dark:border-white/15 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            >
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-slate-200 dark:border-white/15 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100"
          >
            Reset (next question)
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Host controls the timer; you see the same countdown.</p>
      )}
    </div>
  );
}
