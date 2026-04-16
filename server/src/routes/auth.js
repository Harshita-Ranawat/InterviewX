import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import gmailInviteOAuthRouter from "./gmailInviteOAuth.js";
import { encryptSmtpPassword, isCryptoConfigured } from "../lib/smtpCredentialCrypto.js";

function gmailInviteForApi(user) {
  const g = user.gmailInvite;
  const hasToken = Boolean(g?.refreshTokenEnc);
  const sendAs = (g?.sendAsEmail || "").trim();
  return {
    connected: Boolean(hasToken && sendAs),
    sendAsEmail: sendAs,
  };
}

function inviteMailReady(user) {
  const smtpOk = inviteSmtpForApi(user).canSend;
  const g = gmailInviteForApi(user);
  return Boolean(smtpOk || g.connected);
}

function inviteSmtpForApi(user) {
  const s = user.inviteSmtp;
  if (!s?.host?.trim()) {
    return {
      configured: false,
      canSend: false,
      host: "",
      port: 587,
      secure: false,
      user: "",
      fromAddress: "",
      hasSavedPassword: false,
    };
  }
  const hasSavedPassword = Boolean(s.passEnc);
  const userTrim = (s.user || "").trim();
  const canSend = Boolean(userTrim ? hasSavedPassword : true);
  return {
    configured: true,
    canSend,
    host: s.host.trim(),
    port: Number(s.port) || 587,
    secure: Boolean(s.secure),
    user: s.user || "",
    fromAddress: s.fromAddress || "",
    hasSavedPassword,
  };
}

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const u = await User.findById(req.user._id).select("+inviteSmtp.passEnc +gmailInvite.refreshTokenEnc");
  if (!u) {
    return res.status(401).json({ error: "User record missing" });
  }
  res.json({
    id: u._id,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    role: u.role,
    createdAt: u.createdAt,
    inviteSmtp: inviteSmtpForApi(u),
    gmailInvite: gmailInviteForApi(u),
    inviteMailReady: inviteMailReady(u),
  });
});

/** Save SMTP used only for sending interview invites (your mailbox). Password encrypted at rest. */
router.patch("/me/invite-smtp", requireAuth, async (req, res) => {
  const { host, port, secure, user, pass, fromAddress } = req.body;

  const u = await User.findById(req.user._id).select("+inviteSmtp.passEnc");
  if (!u) return res.status(404).json({ error: "User not found" });

  u.inviteSmtp = u.inviteSmtp || {};
  if (host !== undefined) {
    if (typeof host !== "string") return res.status(400).json({ error: "host must be a string" });
    u.inviteSmtp.host = host.trim();
  }
  if (port !== undefined) {
    const p = Number(port);
    if (!Number.isFinite(p) || p < 1 || p > 65535) {
      return res.status(400).json({ error: "port must be between 1 and 65535" });
    }
    u.inviteSmtp.port = p;
  }
  if (secure !== undefined) {
    u.inviteSmtp.secure = Boolean(secure);
  }
  if (user !== undefined) {
    if (typeof user !== "string") return res.status(400).json({ error: "user must be a string" });
    u.inviteSmtp.user = user.trim();
  }
  if (fromAddress !== undefined) {
    if (typeof fromAddress !== "string") return res.status(400).json({ error: "fromAddress must be a string" });
    u.inviteSmtp.fromAddress = fromAddress.trim();
  }

  if (pass !== undefined) {
    if (typeof pass !== "string") return res.status(400).json({ error: "pass must be a string" });
    if (pass.length === 0) {
      u.inviteSmtp.passEnc = "";
    } else {
      if (!isCryptoConfigured()) {
        return res.status(400).json({
          error: "Server is missing INVITE_SMTP_SECRET (needed to store the password safely).",
        });
      }
      try {
        u.inviteSmtp.passEnc = encryptSmtpPassword(pass);
      } catch (e) {
        return res.status(500).json({ error: e.message || "Could not encrypt password" });
      }
    }
  }

  await u.save();
  const fresh = await User.findById(req.user._id).select("+inviteSmtp.passEnc +gmailInvite.refreshTokenEnc");
  res.json({
    inviteSmtp: inviteSmtpForApi(fresh),
    gmailInvite: gmailInviteForApi(fresh),
    inviteMailReady: inviteMailReady(fresh),
  });
});

router.delete("/me/invite-smtp", requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { inviteSmtp: 1 } });
  const u = await User.findById(req.user._id).select("+inviteSmtp.passEnc +gmailInvite.refreshTokenEnc");
  res.json({
    inviteSmtp: inviteSmtpForApi(u),
    gmailInvite: gmailInviteForApi(u),
    inviteMailReady: inviteMailReady(u),
  });
});

router.use(gmailInviteOAuthRouter);

export default router;
