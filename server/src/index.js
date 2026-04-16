import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { initFirebaseAdmin, isFirebaseAdminReady } from "./config/firebaseAdmin.js";
import { registerCodeRoom } from "./sockets/codeRoom.js";
import { registerWebRtcRoom } from "./sockets/webrtcRoom.js";
import authRoutes from "./routes/auth.js";
import interviewRoutes from "./routes/interviews.js";
import aiInterviewRoutes from "./routes/aiInterview.js";

const app = express();
const server = http.createServer(app);

/** Comma-separated list, e.g. http://localhost:5173,http://localhost:5174 */
function clientOrigins() {
  const raw =
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5173,http://localhost:5174";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = clientOrigins();

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

function mongoStatus() {
  const st = mongoose.connection.readyState;
  const labels = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  return { ok: st === 1, state: st, label: labels[st] ?? "unknown" };
}

app.get("/health", (_req, res) => {
  const mongo = mongoStatus();
  const firebaseOk = isFirebaseAdminReady();
  const firebase = { ok: firebaseOk, label: firebaseOk ? "ready" : "not_configured" };
  const ready = mongo.ok && firebase.ok;
  res.json({
    ok: true,
    ready,
    service: "interview-platform-api",
    server: { ok: true, port: Number(process.env.PORT) || 4000 },
    mongo,
    firebase,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/ai-interview", aiInterviewRoutes);

registerCodeRoom(io);
registerWebRtcRoom(io);

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/interview-platform";

function logStartupHealth(port) {
  const mongo = mongoStatus();
  const firebaseOk = isFirebaseAdminReady();
  const lines = [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  Interview Platform API — health @ listen",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `  Server:   UP     http://localhost:${port}`,
    `  MongoDB:  ${mongo.ok ? "UP" : "DOWN"}   (${mongo.label}, readyState=${mongo.state})`,
    `  Firebase: ${firebaseOk ? "UP" : "DOWN"}   (Admin SDK ${firebaseOk ? "initialized" : "not configured"})`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ];
  console.log(lines.join("\n"));
}

async function main() {
  initFirebaseAdmin();
  await mongoose.connect(MONGODB_URI);
  server.listen(PORT, () => {
    logStartupHealth(PORT);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
