import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { auth } from "../firebase.js";

function socketBase() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (import.meta.env.DEV) return "http://localhost:4000";
  return window.location.origin;
}

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function IconMic({ muted }) {
  return muted ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 22h8" />
      <path d="M2 2l20 20" strokeLinecap="round" />
    </svg>
  ) : (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 22h8" strokeLinecap="round" />
    </svg>
  );
}

function IconVideo({ off }) {
  return off ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="14" height="12" rx="2" />
      <path d="M17 9l4-2v10l-4-2M2 2l20 20" strokeLinecap="round" />
    </svg>
  ) : (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="14" height="12" rx="2" />
      <path d="M17 9l4-2v10l-4-2" strokeLinecap="round" />
    </svg>
  );
}

function IconPhoneDown() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.15 15.15 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.56.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 0 11.36 11.36 0 00.57 3.56 1 1 0 01-.24 1.01l-2.2 2.22z" />
    </svg>
  );
}

function initialsFrom(nameOrEmail) {
  const s = (nameOrEmail || "?").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  if (s.includes("@")) return s[0].toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function AvatarTile({ photoURL, label, speaking, large, fill }) {
  const base = fill
    ? "h-full w-full min-h-0 aspect-auto rounded-none border-0 text-4xl sm:text-5xl"
    : large
      ? "min-h-[240px] max-h-[50vh] rounded-xl text-5xl w-full aspect-video"
      : "min-h-[140px] max-h-40 rounded-lg text-3xl w-full aspect-video";
  return (
    <div
      className={`relative flex items-center justify-center border border-slate-200 dark:border-white/10 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-900 text-slate-700 dark:text-slate-100 font-display font-semibold ${base} ${
        speaking ? "ring-4 ring-accent ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 shadow-[0_0_20px_rgba(99,102,241,0.45)]" : ""
      } transition-shadow duration-150`}
    >
      {photoURL ? (
        <img src={photoURL} alt="" className="absolute inset-0 h-full w-full object-cover rounded-[inherit]" />
      ) : (
        <span className="relative z-[1]">{initialsFrom(label)}</span>
      )}
      {speaking && (
        <div className="absolute bottom-3 left-1/2 flex h-7 -translate-x-1/2 items-end gap-1" aria-hidden>
          {[6, 12, 8, 14].map((h, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-accent animate-bounce"
              style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {'default' | 'spotlight'} layout
 * @param {boolean} isHost — host "End" ends meeting for everyone; guests only leave.
 */
export default function RoomVideo({
  roomCode,
  onEndCall,
  layout = "default",
  isHost = false,
  displayName = "",
  photoURL = "",
}) {
  const myId = auth.currentUser?.uid || "";
  const [status, setStatus] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const localVideoRef = useRef(null);
  const remoteWrapRef = useRef(null);
  const streamRef = useRef(null);
  const peersRef = useRef(new Map());
  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const onEndCallRef = useRef(onEndCall);
  useEffect(() => {
    onEndCallRef.current = onEndCall;
  }, [onEndCall]);

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    socketRef.current?.disconnect();
    socketRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    remoteWrapRef.current?.querySelectorAll("[data-remote-wrap]").forEach((el) => el.remove());
  }, []);

  const leaveOrEnd = useCallback(() => {
    if (isHost && socketRef.current?.connected) {
      socketRef.current.emit("webrtc-host-end", { roomId: roomCode });
    }
    teardown();
    onEndCall?.();
  }, [isHost, roomCode, teardown, onEndCall]);

  useEffect(() => {
    if (!roomCode || !myId) return undefined;

    const attachRemoteVideo = (userId, stream) => {
      const wrap = remoteWrapRef.current;
      if (!wrap) return;
      let outer = wrap.querySelector(`[data-remote-wrap="${userId}"]`);
      const syncCam = (vidEl, phEl, s) => {
        const vt = s.getVideoTracks()[0];
        const on = vt && vt.readyState === "live" && vt.enabled && !vt.muted;
        if (vidEl) vidEl.style.opacity = on ? "1" : "0";
        if (phEl) phEl.style.opacity = on ? "0" : "1";
      };
      if (!outer) {
        outer = document.createElement("div");
        outer.dataset.remoteWrap = userId;
        outer.className = "relative w-full aspect-video rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-800";
        const vid = document.createElement("video");
        vid.dataset.remote = userId;
        vid.autoplay = true;
        vid.playsInline = true;
        vid.className =
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-200 opacity-100";
        const ph = document.createElement("div");
        ph.dataset.remotePlaceholder = userId;
        ph.className =
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-slate-100 font-display text-2xl font-semibold opacity-0 pointer-events-none transition-opacity duration-200";
        ph.textContent = initialsFrom(userId);
        outer.appendChild(vid);
        outer.appendChild(ph);
        wrap.appendChild(outer);

        stream.getVideoTracks().forEach((t) => {
          const fn = () => syncCam(vid, ph, stream);
          t.addEventListener("mute", fn);
          t.addEventListener("unmute", fn);
          t.addEventListener("ended", fn);
        });
        syncCam(vid, ph, stream);
      }
      const vid = outer.querySelector("video");
      const ph = outer.querySelector(`[data-remote-placeholder="${userId}"]`);
      if (vid) vid.srcObject = stream;
      syncCam(vid, ph, stream);
    };

    const removeRemoteVideo = (userId) => {
      const wrap = remoteWrapRef.current;
      if (!wrap) return;
      wrap.querySelector(`[data-remote-wrap="${userId}"]`)?.remove();
    };

    const closePeer = (remoteId) => {
      const pc = peersRef.current.get(remoteId);
      if (pc) {
        pc.close();
        peersRef.current.delete(remoteId);
      }
      removeRemoteVideo(remoteId);
    };

    const emitSignal = (targetUserId, payload) => {
      socketRef.current?.emit("webrtc-signal", { roomId: roomCode, targetUserId, payload });
    };

    const ensurePeer = (remoteId, initiator) => {
      if (!remoteId || remoteId === myId) return;
      if (peersRef.current.has(remoteId)) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(remoteId, pc);

      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));

      pc.ontrack = (ev) => {
        if (ev.streams[0]) attachRemoteVideo(remoteId, ev.streams[0]);
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          emitSignal(remoteId, { type: "ice", candidate: ev.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          closePeer(remoteId);
        }
      };

      if (initiator) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            emitSignal(remoteId, { type: "offer", sdp: pc.localDescription });
          } catch {
            closePeer(remoteId);
          }
        })();
      }
    };

    const handleSignal = async ({ fromUserId, payload }) => {
      if (!fromUserId || fromUserId === myId || !payload) return;
      let pc = peersRef.current.get(fromUserId);
      if (!pc && payload.type === "offer") {
        ensurePeer(fromUserId, false);
        pc = peersRef.current.get(fromUserId);
      }
      if (!pc) return;

      try {
        if (payload.type === "offer" && payload.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitSignal(fromUserId, { type: "answer", sdp: pc.localDescription });
        } else if (payload.type === "answer" && payload.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === "ice" && payload.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch {
        /* ignore */
      }
    };

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setStatus("Connecting…");
      } catch (e) {
        setStatus(e.message || "Camera/mic denied");
        return;
      }

      const s = io(`${socketBase()}/webrtc`, { transports: ["websocket"] });
      socketRef.current = s;

      s.on("connect", () => {
        s.emit("webrtc-join", { roomId: roomCode, userId: myId });
      });

      s.on("webrtc-room-ended", () => {
        teardown();
        onEndCallRef.current?.();
      });

      s.on("webrtc-roster", ({ peers }) => {
        (peers || []).forEach((pid) => {
          if (myId < pid) ensurePeer(pid, true);
        });
      });

      s.on("webrtc-peer-joined", ({ userId }) => {
        if (userId && userId !== myId && myId < userId) ensurePeer(userId, true);
      });

      s.on("webrtc-peer-left", ({ userId }) => {
        if (userId) closePeer(userId);
      });

      s.on("webrtc-signal", handleSignal);

      setStatus("Live");
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [roomCode, myId, teardown]);

  useEffect(() => {
    const s = streamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
  }, [micOn]);

  useEffect(() => {
    const s = streamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => {
      t.enabled = camOn;
    });
  }, [camOn]);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      audioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    audioCtxRef.current = null;
    analyserRef.current = null;

    const stream = streamRef.current;
    if (!stream || !micOn || camOn) {
      setLocalSpeaking(false);
      return undefined;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setLocalSpeaking(false);
      return undefined;
    }

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setLocalSpeaking(avg > 12);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setLocalSpeaking(false);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        audioCtxRef.current?.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    };
  }, [micOn, camOn]);

  const vidLocalClass =
    layout === "spotlight"
      ? "absolute inset-0 h-full w-full object-cover transition-opacity duration-200 min-h-[240px] max-h-[50vh]"
      : "absolute inset-0 h-full w-full object-cover transition-opacity duration-200";

  const gridClass = layout === "spotlight" ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "grid sm:grid-cols-2 gap-3";
  const label = displayName || auth.currentUser?.displayName || auth.currentUser?.email || "You";
  const pic = photoURL || auth.currentUser?.photoURL || "";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-ink-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-slate-800 dark:text-white">Video call</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMicOn((v) => !v)}
            title={micOn ? "Mute microphone" : "Unmute microphone"}
            aria-label={micOn ? "Mute" : "Unmute"}
            className={`rounded-full p-2.5 border ${
              micOn
                ? "border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
                : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-200"
            }`}
          >
            <IconMic muted={!micOn} />
          </button>
          <button
            type="button"
            onClick={() => setCamOn((v) => !v)}
            title={camOn ? "Turn camera off" : "Turn camera on"}
            aria-label={camOn ? "Camera off" : "Camera on"}
            className={`rounded-full p-2.5 border ${
              camOn
                ? "border-slate-200 dark:border-white/15 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
            }`}
          >
            <IconVideo off={!camOn} />
          </button>
          <button
            type="button"
            onClick={leaveOrEnd}
            title={isHost ? "End meeting for everyone" : "Leave call (you can rejoin from Interviews)"}
            aria-label={isHost ? "End meeting for everyone" : "Leave call"}
            className="rounded-full p-2.5 bg-rose-600 text-white hover:bg-rose-700 border border-rose-700 ml-1"
          >
            <IconPhoneDown />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p>
      <div className={gridClass}>
        <div>
          <div className="text-[10px] uppercase text-slate-500 dark:text-slate-500 mb-1">You</div>
          <div
            className={`relative w-full overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-900 ${
              layout === "spotlight" ? "rounded-xl min-h-[240px] max-h-[50vh] aspect-video" : "rounded-lg aspect-video"
            }`}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`${vidLocalClass} ${camOn ? "opacity-100 z-10" : "opacity-0 z-0"}`}
            />
            {!camOn && (
              <div className="absolute inset-0 z-[5]">
                <AvatarTile
                  photoURL={pic}
                  label={label}
                  speaking={micOn && localSpeaking}
                  large={layout === "spotlight"}
                  fill
                />
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-slate-500 dark:text-slate-500 mb-1">Participants</div>
          <div ref={remoteWrapRef} className="flex flex-col gap-2 min-h-[120px]" />
        </div>
      </div>
    </div>
  );
}
