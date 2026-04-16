import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Interview, DEFAULT_CODING_STARTER } from "../models/Interview.js";
import { User } from "../models/User.js";
import { generateRoomCode, generateInviteToken } from "../utils/roomCode.js";
import { sendHostInterviewInvite } from "../lib/inviteEmail.js";
import { decryptSmtpPassword } from "../lib/smtpCredentialCrypto.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { title, description, scheduledAt, durationMinutes, participantUserIds, interviewFormat, codingStarterCode } =
    req.body;
  if (!title || !scheduledAt) {
    return res.status(400).json({ error: "title and scheduledAt required" });
  }
  const format =
    interviewFormat === "face_to_face" || interviewFormat === "coding" ? interviewFormat : "coding";
  let roomCode = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const exists = await Interview.findOne({ roomCode });
    if (!exists) break;
    roomCode = generateRoomCode();
  }

  const participants = [{ userId: req.user._id, role: "host" }];
  if (Array.isArray(participantUserIds)) {
    for (const id of participantUserIds) {
      if (String(id) !== String(req.user._id)) {
        participants.push({ userId: id, role: "candidate" });
      }
    }
  }

  const starter = format === "coding" ? codingStarterCode || DEFAULT_CODING_STARTER : "";

  const interview = await Interview.create({
    title,
    description: description || "",
    scheduledAt: new Date(scheduledAt),
    durationMinutes: durationMinutes || 60,
    hostUserId: req.user._id,
    participants,
    roomCode,
    interviewFormat: format,
    codingStarterCode: starter,
  });
  res.status(201).json(interview);
});

router.get("/", requireAuth, async (req, res) => {
  const list = await Interview.find({
    $or: [
      { hostUserId: req.user._id },
      { "participants.userId": req.user._id },
      { "invites.email": req.user.email.toLowerCase() },
    ],
  })
    .sort({ scheduledAt: -1 })
    .populate("hostUserId", "email displayName")
    .populate("participants.userId", "email displayName")
    .limit(100)
    .lean();
  res.json(list);
});

router.get("/dashboard-stats", requireAuth, async (req, res) => {
  const uid = req.user._id;
  const [total, upcoming, asHost] = await Promise.all([
    Interview.countDocuments({
      $or: [{ hostUserId: uid }, { "participants.userId": uid }],
    }),
    Interview.countDocuments({
      $or: [{ hostUserId: uid }, { "participants.userId": uid }],
      status: "scheduled",
      scheduledAt: { $gte: new Date() },
    }),
    Interview.countDocuments({ hostUserId: uid }),
  ]);
  res.json({ total, upcoming, hosted: asHost });
});

router.get("/by-room/:code", requireAuth, async (req, res) => {
  const interview = await Interview.findOne({ roomCode: req.params.code.toUpperCase() })
    .populate("hostUserId", "email displayName")
    .populate("participants.userId", "email displayName");
  if (!interview) return res.status(404).json({ error: "Not found" });
  const allowed =
    String(interview.hostUserId?._id || interview.hostUserId) === String(req.user._id) ||
    interview.participants.some((p) => String(p.userId?._id || p.userId) === String(req.user._id)) ||
    interview.invites.some((i) => i.email === req.user.email.toLowerCase());
  if (!allowed) return res.status(403).json({ error: "Forbidden" });
  res.json(interview);
});

router.get("/:id", requireAuth, async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate("hostUserId", "email displayName")
    .populate("participants.userId", "email displayName");
  if (!interview) return res.status(404).json({ error: "Not found" });
  const allowed =
    String(interview.hostUserId?._id || interview.hostUserId) === String(req.user._id) ||
    interview.participants.some((p) => String(p.userId?._id || p.userId) === String(req.user._id)) ||
    interview.invites.some((i) => i.email === req.user.email.toLowerCase());
  if (!allowed) return res.status(403).json({ error: "Forbidden" });
  res.json(interview);
});

router.patch("/:id", requireAuth, async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ error: "Not found" });
  if (String(interview.hostUserId) !== String(req.user._id)) {
    return res.status(403).json({ error: "Only the host can update this interview" });
  }
  const {
    title,
    description,
    scheduledAt,
    durationMinutes,
    status,
    notes,
    recordingUrl,
    interviewFormat,
    codingStarterCode,
  } = req.body;
  if (title != null) interview.title = title;
  if (description != null) interview.description = description;
  if (scheduledAt != null) interview.scheduledAt = new Date(scheduledAt);
  if (durationMinutes != null) interview.durationMinutes = durationMinutes;
  if (status != null && status !== "completed") {
    interview.status = status;
  }
  if (notes != null) interview.notes = notes;
  if (recordingUrl != null) interview.recordingUrl = recordingUrl;
  if (interviewFormat === "coding" || interviewFormat === "face_to_face") {
    interview.interviewFormat = interviewFormat;
  }
  if (codingStarterCode != null) interview.codingStarterCode = codingStarterCode;
  await interview.save();
  res.json(interview);
});

router.post("/:id/invite", requireAuth, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ error: "Not found" });
  if (String(interview.hostUserId) !== String(req.user._id)) {
    return res.status(403).json({ error: "Only the host can invite" });
  }
  const token = generateInviteToken();
  const to = email.toLowerCase().trim();
  interview.invites.push({ email: to, token, status: "pending" });
  await interview.save();

  const hostUser = await User.findById(req.user._id).select("+inviteSmtp.passEnc +gmailInvite.refreshTokenEnc");

  let gmailOAuth = null;
  if (hostUser?.gmailInvite?.refreshTokenEnc) {
    const rt = decryptSmtpPassword(hostUser.gmailInvite.refreshTokenEnc);
    if (rt === null) {
      return res.status(201).json({
        invite: interview.invites[interview.invites.length - 1],
        roomCode: interview.roomCode,
        interviewId: interview._id,
        emailDelivery: {
          sent: false,
          error:
            "Could not decrypt your saved Gmail token. Set INVITE_SMTP_SECRET on the server or disconnect Gmail and connect again.",
        },
      });
    }
    const sendAs = (hostUser.gmailInvite.sendAsEmail || "").trim();
    if (sendAs) {
      gmailOAuth = { refreshToken: rt, sendAsEmail: sendAs };
    }
  }

  let userSmtp = null;
  const smtp = hostUser?.inviteSmtp;
  if (smtp?.host?.trim()) {
    const userTrim = (smtp.user || "").trim();
    let pass = "";
    if (smtp.passEnc) {
      const plain = decryptSmtpPassword(smtp.passEnc);
      if (plain === null) {
        return res.status(201).json({
          invite: interview.invites[interview.invites.length - 1],
          roomCode: interview.roomCode,
          interviewId: interview._id,
          emailDelivery: {
            sent: false,
            error:
              "Could not decrypt your saved SMTP password. Set INVITE_SMTP_SECRET on the server to match when you saved it, or clear and re-save Invite mail settings.",
          },
        });
      }
      pass = plain;
    }
    if (userTrim && !smtp.passEnc) {
      return res.status(201).json({
        invite: interview.invites[interview.invites.length - 1],
        roomCode: interview.roomCode,
        interviewId: interview._id,
        emailDelivery: {
          sent: false,
          skipReason:
            "Your SMTP username is set but no password is saved. Add an app password under Settings → Invite mail.",
        },
      });
    }
    userSmtp = {
      host: smtp.host.trim(),
      port: Number(smtp.port) || 587,
      secure: Boolean(smtp.secure),
      user: smtp.user || "",
      pass,
      fromAddress: smtp.fromAddress || "",
    };
  }

  const emailResult = await sendHostInterviewInvite({
    to,
    inviteToken: token,
    interviewTitle: interview.title || "Interview",
    hostLabel: req.user.displayName || req.user.email,
    gmailOAuth,
    userSmtp,
  });

  res.status(201).json({
    invite: interview.invites[interview.invites.length - 1],
    roomCode: interview.roomCode,
    interviewId: interview._id,
    emailDelivery: emailResult,
  });
});

router.post("/invite/accept", requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });
  const interview = await Interview.findOne({ "invites.token": token });
  if (!interview) return res.status(404).json({ error: "Invalid token" });
  const inv = interview.invites.find((i) => i.token === token);
  if (!inv || inv.email !== req.user.email.toLowerCase()) {
    return res.status(403).json({ error: "Invite email mismatch" });
  }
  inv.status = "accepted";
  const already = interview.participants.some((p) => String(p.userId) === String(req.user._id));
  if (!already) {
    interview.participants.push({
      userId: req.user._id,
      role: "candidate",
    });
  }
  await interview.save();
  res.json(interview);
});

router.post("/:id/join", requireAuth, async (req, res) => {
  const interview = await Interview.findById(req.params.id);
  if (!interview) return res.status(404).json({ error: "Not found" });
  const invited = interview.invites.some((i) => i.email === req.user.email.toLowerCase());
  const isHost = String(interview.hostUserId) === String(req.user._id);
  if (!isHost && !invited) {
    return res.status(403).json({ error: "Not invited" });
  }
  const already = interview.participants.some((p) => String(p.userId) === String(req.user._id));
  if (!already) {
    interview.participants.push({
      userId: req.user._id,
      role: isHost ? "host" : "candidate",
      joinedAt: new Date(),
    });
    await interview.save();
  }
  res.json({ ok: true, roomCode: interview.roomCode, interview });
});

export default router;
