import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AIInterviewSession } from "../models/AIInterviewSession.js";
import { AIInterviewReport } from "../models/AIInterviewReport.js";
import { getInterviewReply, generateInterviewReport } from "../services/openaiService.js";

const router = Router();

router.post("/sessions", requireAuth, async (req, res) => {
  const { topic } = req.body;
  if (!topic || typeof topic !== "string") {
    return res.status(400).json({ error: "topic required" });
  }
  const session = await AIInterviewSession.create({
    userId: req.user._id,
    topic: topic.trim(),
    messages: [
      {
        role: "system",
        content: "Session started",
        at: new Date(),
      },
    ],
  });
  try {
    const opening = await getInterviewReply({
      topic: session.topic,
      history: [
        {
          role: "user",
          content:
            "The candidate just joined. Greet them briefly and ask your first interview question for this topic.",
        },
      ],
    });
    session.messages.push({ role: "assistant", content: opening });
    await session.save();
    res.status(201).json({ sessionId: session._id, opening, topic: session.topic });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "OpenAI error" });
  }
});

router.post("/sessions/:id/message", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  const session = await AIInterviewSession.findById(req.params.id);
  if (!session || String(session.userId) !== String(req.user._id)) {
    return res.status(404).json({ error: "Session not found" });
  }
  if (session.status !== "active") {
    return res.status(400).json({ error: "Session not active" });
  }
  session.messages.push({ role: "user", content: text });
  const history = session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  try {
    const reply = await getInterviewReply({ topic: session.topic, history });
    session.messages.push({ role: "assistant", content: reply });
    await session.save();
    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "OpenAI error" });
  }
});

router.post("/sessions/:id/complete", requireAuth, async (req, res) => {
  const session = await AIInterviewSession.findById(req.params.id);
  if (!session || String(session.userId) !== String(req.user._id)) {
    return res.status(404).json({ error: "Session not found" });
  }
  if (session.reportId) {
    const existing = await AIInterviewReport.findById(session.reportId);
    return res.json({ report: existing, session });
  }
  session.status = "completed";
  const lines = session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`);
  const transcript = lines.join("\n");
  let parsed;
  let raw;
  try {
    const out = await generateInterviewReport({ topic: session.topic, transcript });
    parsed = out.parsed;
    raw = out.raw;
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || "Report generation failed" });
  }
  const report = await AIInterviewReport.create({
    sessionId: session._id,
    userId: req.user._id,
    topic: session.topic,
    summary: parsed.summary || "",
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    sampleBetterAnswers: parsed.sampleBetterAnswers || [],
    scores: parsed.scores || {},
    overallScore: parsed.overallScore ?? 5,
    recommendations: parsed.recommendations || "",
    rawModelOutput: raw,
  });
  session.reportId = report._id;
  await session.save();
  res.json({ report, session });
});

router.get("/sessions", requireAuth, async (req, res) => {
  const sessions = await AIInterviewSession.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("reportId")
    .lean();
  res.json(sessions);
});

router.get("/reports", requireAuth, async (req, res) => {
  const reports = await AIInterviewReport.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.json(reports);
});

router.get("/reports/:id", requireAuth, async (req, res) => {
  const report = await AIInterviewReport.findById(req.params.id);
  if (!report) return res.status(404).json({ error: "Not found" });
  if (String(report.userId) !== String(req.user._id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(report);
});

export default router;
