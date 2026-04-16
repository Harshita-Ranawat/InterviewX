import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { io } from "socket.io-client";
import { doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "../firebase.js";
import { apiFetch } from "../api/http.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import RoomVideo from "../components/RoomVideo.jsx";
import QuestionTimer from "../components/QuestionTimer.jsx";

function socketUrl() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (import.meta.env.DEV) return "http://localhost:4000";
  return window.location.origin;
}

export default function InterviewRoomPage() {
  const { isDark } = useTheme();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { code } = useParams();
  const [interview, setInterview] = useState(null);
  const [language, setLanguage] = useState("javascript");
  const [localCode, setLocalCode] = useState(
    '// Shared live coding pad\nfunction hello() {\n  return "hi";\n}\n'
  );
  const [remoteLabel, setRemoteLabel] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordStatus, setRecordStatus] = useState("");
  const [codeSocket, setCodeSocket] = useState(null);
  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const isCoding = Boolean(interview && interview.interviewFormat !== "face_to_face");
  const isHost =
    interview &&
    profile?.id &&
    String(interview.hostUserId?._id || interview.hostUserId) === String(profile.id);

  const applyRemote = useRef(null);
  applyRemote.current = (value) => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    const current = model.getValue();
    if (current === value) return;
    editorRef.current.setValue(value);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const iv = await apiFetch(`/api/interviews/by-room/${code}`);
        if (cancelled) return;
        setInterview(iv);
        if (iv.interviewFormat !== "face_to_face" && iv.codingStarterCode) {
          setLocalCode(iv.codingStarterCode);
        }
        await apiFetch(`/api/interviews/${iv._id}/join`, { method: "POST" });
        const uid = auth.currentUser?.uid;
        if (uid && code) {
          const r = doc(db, "rooms", code, "attendees", uid);
          await setDoc(
            r,
            {
              displayName: auth.currentUser?.displayName || auth.currentUser?.email || "Guest",
              joinedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (e) {
        if (!cancelled) setRecordStatus(e.message || "Could not load room");
      }
    })();
    return () => {
      cancelled = true;
      const uid = auth.currentUser?.uid;
      if (uid && code) {
        deleteDoc(doc(db, "rooms", code, "attendees", uid)).catch(() => {});
      }
    };
  }, [code]);

  useEffect(() => {
    if (!isCoding || !code) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setCodeSocket(null);
      return undefined;
    }
    const s = io(`${socketUrl()}/code`, { transports: ["websocket"] });
    socketRef.current = s;
    s.on("connect", () => {
      setCodeSocket(s);
      s.emit("join-room", {
        roomId: code,
        userId: auth.currentUser?.uid,
        displayName: auth.currentUser?.displayName || auth.currentUser?.email,
      });
    });
    s.on("code-remote", ({ code: remote, from }) => {
      if (from === auth.currentUser?.uid) return;
      setRemoteLabel("Remote update applied");
      applyRemote.current?.(remote);
    });
    s.on("peer-joined", ({ displayName }) => {
      setRemoteLabel(`${displayName || "Someone"} joined`);
    });
    s.on("peer-left", () => setRemoteLabel("Peer left"));
    return () => {
      s.disconnect();
      socketRef.current = null;
      setCodeSocket(null);
    };
  }, [code, isCoding]);

  const pushTimer = useRef(null);
  const broadcast = useCallback(
    (value) => {
      if (!isCoding) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => {
        socketRef.current?.emit("code-update", {
          roomId: code,
          code: value,
          language,
        });
      }, 250);
    },
    [code, language, isCoding]
  );

  const onEditorMount = (editor) => {
    editorRef.current = editor;
  };

  const toggleRecording = async () => {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        if (!interview?._id) return;
        try {
          setRecordStatus("Uploading recording…");
          const path = `interviews/${interview._id}/${Date.now()}.webm`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          await apiFetch(`/api/interviews/${interview._id}`, {
            method: "PATCH",
            body: JSON.stringify({ recordingUrl: url }),
          });
          setRecordStatus("Recording saved to Firebase Storage.");
        } catch (err) {
          setRecordStatus(err.message || "Upload failed");
        }
      };
      mediaRecorderRef.current = mr;
      mr.start(1000);
      setRecording(true);
      setRecordStatus("Recording…");
    } catch (err) {
      setRecordStatus(err.message || "Could not access camera/mic");
    }
  };

  const handleEndCall = useCallback(() => {
    navigate("/interviews");
  }, [navigate]);

  const formatLabel =
    interview?.interviewFormat === "face_to_face" ? "Face-to-face (no coding)" : "Coding interview";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl text-slate-900 dark:text-white">Live room · {code}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          <span className="font-medium text-slate-800 dark:text-slate-200">{formatLabel}</span>
          {isCoding ? " · WebRTC video, shared editor, and question timer." : " · WebRTC video only — no shared editor."}
        </p>
      </div>

      {interview && (
        <div className="text-xs text-slate-500 dark:text-slate-500">
          Interview: <span className="text-slate-800 dark:text-slate-300">{interview.title}</span>
        </div>
      )}

      <RoomVideo
        roomCode={code}
        onEndCall={handleEndCall}
        layout={isCoding ? "default" : "spotlight"}
        isHost={Boolean(isHost)}
        displayName={profile?.displayName || user?.displayName || user?.email || ""}
        photoURL={user?.photoURL || profile?.photoURL || ""}
      />

      {isCoding && <QuestionTimer socket={codeSocket} roomCode={code} isHost={Boolean(isHost)} />}

      <div className="flex flex-wrap gap-3 items-center">
        {isCoding && (
          <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            Editor language
            <select
              className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={toggleRecording}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            recording ? "bg-rose-500 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-white/20"
          }`}
        >
          {recording ? "Stop recording" : "Record session (browser)"}
        </button>
        {recordStatus && <span className="text-xs text-slate-600 dark:text-slate-400">{recordStatus}</span>}
        {remoteLabel && <span className="text-xs text-emerald-600 dark:text-emerald-400">{remoteLabel}</span>}
      </div>

      {isCoding && (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden h-[420px] bg-white dark:bg-[#0b1220]">
            <Editor
              height="100%"
              theme={isDark ? "vs-dark" : "light"}
              path={`pad.${language === "typescript" ? "ts" : language === "python" ? "py" : language === "go" ? "go" : "js"}`}
              defaultLanguage={language === "typescript" ? "typescript" : language}
              value={localCode}
              onChange={(v) => {
                const val = v ?? "";
                setLocalCode(val);
                broadcast(val);
              }}
              onMount={onEditorMount}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
