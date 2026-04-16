import crypto from "crypto";
import { Router } from "express";
import { google } from "googleapis";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import {
  encryptSmtpPassword,
  isCryptoConfigured,
} from "../lib/smtpCredentialCrypto.js";
import { gmailOAuthRedirectUri } from "../lib/publicAppUrl.js";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

const router = Router();

function gmailClientConfigured() {
  return Boolean(
    process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() && process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim()
  );
}

/** Start Google OAuth (user signs in once; we store refresh token for sending invites). */
router.post("/gmail-invite/start", requireAuth, async (req, res) => {
  if (!gmailClientConfigured()) {
    return res.status(503).json({
      error:
        "Gmail connect is not enabled on this server (set GOOGLE_GMAIL_CLIENT_ID and GOOGLE_GMAIL_CLIENT_SECRET).",
    });
  }
  const state = crypto.randomBytes(24).toString("hex");

  const u = await User.findById(req.user._id);
  if (!u) return res.status(404).json({ error: "User not found" });

  u.gmailLinkPending = {
    state,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };
  await u.save();

  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID.trim();
  const redirectUri = gmailOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SEND_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url });
});

/** Exchange OAuth code after Google redirects back to the SPA. */
router.post("/gmail-invite/complete", requireAuth, async (req, res) => {
  const { code, state } = req.body;
  if (!code || !state || typeof code !== "string" || typeof state !== "string") {
    return res.status(400).json({ error: "code and state required" });
  }
  if (!isCryptoConfigured()) {
    return res.status(400).json({ error: "Server missing INVITE_SMTP_SECRET (required to store the token)." });
  }
  if (!gmailClientConfigured()) {
    return res.status(503).json({ error: "Gmail OAuth is not configured on this server." });
  }

  const u = await User.findById(req.user._id);
  if (!u) return res.status(404).json({ error: "User not found" });

  const pending = u.gmailLinkPending;
  if (!pending?.state || pending.state !== state) {
    return res.status(400).json({ error: "Invalid or expired OAuth state. Start connect again." });
  }
  if (!pending.expiresAt || pending.expiresAt < new Date()) {
    return res.status(400).json({ error: "OAuth state expired. Start connect again." });
  }

  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID.trim();
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET.trim();
  const redirectUri = gmailOAuthRedirectUri();

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  let tokens;
  try {
    const tr = await oauth2.getToken(code);
    tokens = tr.tokens;
  } catch (e) {
    return res.status(400).json({
      error: e?.response?.data?.error_description || e?.message || "Token exchange failed",
    });
  }

  if (!tokens.refresh_token) {
    return res.status(400).json({
      error:
        "Google did not return a refresh token. Remove app access at https://myaccount.google.com/permissions and try again (use Connect and complete consent).",
    });
  }

  oauth2.setCredentials(tokens);
  let sendAsEmail = "";
  try {
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const { data } = await oauth2Api.userinfo.get();
    sendAsEmail = (data.email || "").trim().toLowerCase();
  } catch {
    /* optional */
  }
  if (!sendAsEmail) {
    sendAsEmail = (u.email || "").toLowerCase();
  }

  let refreshEnc;
  try {
    refreshEnc = encryptSmtpPassword(tokens.refresh_token);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Could not encrypt refresh token" });
  }

  u.gmailInvite = {
    refreshTokenEnc: refreshEnc,
    sendAsEmail,
    connectedAt: new Date(),
  };
  u.gmailLinkPending = undefined;
  await u.save();

  res.json({
    gmailInvite: {
      connected: true,
      sendAsEmail,
    },
  });
});

router.delete("/gmail-invite", requireAuth, async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    { $unset: { gmailInvite: 1, gmailLinkPending: 1 } }
  );
  res.json({ ok: true });
});

export default router;
