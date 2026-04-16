import nodemailer from "nodemailer";
import { getInterviewInviteBodies } from "./inviteTemplates.js";
import { getPublicAppBaseUrl } from "./publicAppUrl.js";
import { sendInterviewInviteViaGmailOAuth } from "./gmailInviteSend.js";

export { getPublicAppBaseUrl } from "./publicAppUrl.js";

let cachedFallbackTransport = null;
let cachedFallbackKey = "";

function fallbackSmtpConfigKey() {
  const host = process.env.SMTP_HOST?.trim() || "";
  const portNum = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" || portNum === 465 ? "1" : "0";
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  return `${host}|${portNum}|${secure}|${user}|${pass.length}`;
}

function getFallbackSmtpTransport() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";

  const key = fallbackSmtpConfigKey();
  if (cachedFallbackTransport && cachedFallbackKey === key) {
    return cachedFallbackTransport;
  }

  const options = { host, port, secure };
  if (user || pass) {
    options.auth = { user, pass };
  }
  cachedFallbackKey = key;
  cachedFallbackTransport = nodemailer.createTransport(options);
  return cachedFallbackTransport;
}

function fallbackFromAddress() {
  const explicit = process.env.SMTP_FROM?.trim();
  if (explicit) return explicit;
  const user = process.env.SMTP_USER?.trim();
  if (user && user.includes("@")) return user;
  return `"Interview Platform" <noreply@localhost>`;
}

export function createTransportFromSmtpConfig(cfg) {
  if (!cfg?.host?.trim()) return null;
  const port = Number(cfg.port || 587);
  const secure = Boolean(cfg.secure) || port === 465;
  const options = {
    host: cfg.host.trim(),
    port,
    secure,
  };
  const user = (cfg.user || "").trim();
  const pass = (cfg.pass || "").trim();
  if (user || pass) {
    options.auth = { user, pass };
  }
  return nodemailer.createTransport(options);
}

function fromForUserSmtp(cfg, hostLabel) {
  const explicit = (cfg.fromAddress || "").trim();
  if (explicit) return explicit;
  const user = (cfg.user || "").trim();
  const name = String(hostLabel || "Interview").replace(/"/g, "'");
  if (user && user.includes("@")) return `"${name}" <${user}>`;
  if (user) return `"${name}" <${user}>`;
  return `"${name}" <noreply@localhost>`;
}

/**
 * Gmail OAuth first (if provided), then personal SMTP, then optional server SMTP_*.
 * @param {{ refreshToken: string, sendAsEmail: string } | null} gmailOAuth
 * @param {object | null} userSmtp
 */
export async function sendHostInterviewInvite({
  to,
  inviteToken,
  interviewTitle,
  hostLabel,
  gmailOAuth,
  userSmtp,
}) {
  if (gmailOAuth?.refreshToken && gmailOAuth?.sendAsEmail) {
    const g = await sendInterviewInviteViaGmailOAuth({
      refreshToken: gmailOAuth.refreshToken,
      sendAsEmail: gmailOAuth.sendAsEmail,
      hostLabel,
      to,
      inviteToken,
      interviewTitle,
    });
    if (g.sent) {
      return { sent: true, id: g.id, usedFallback: false, via: "gmail" };
    }
    // fall through to SMTP if Gmail failed (e.g. revoked token)
  }

  return sendInterviewInviteEmail({
    to,
    inviteToken,
    interviewTitle,
    hostLabel,
    userSmtp,
  });
}

/**
 * @param {{ host: string, port: number, secure: boolean, user?: string, pass?: string, fromAddress?: string } | null} [userSmtp]
 */
export async function sendInterviewInviteEmail({
  to,
  inviteToken,
  interviewTitle,
  hostLabel,
  userSmtp,
}) {
  const { subject, text, html } = getInterviewInviteBodies({
    to,
    inviteToken,
    interviewTitle,
    hostLabel,
  });

  let transport = null;
  let from = "";
  let usedFallback = false;

  if (userSmtp?.host?.trim()) {
    transport = createTransportFromSmtpConfig(userSmtp);
    from = fromForUserSmtp(userSmtp, hostLabel);
  }

  if (!transport) {
    transport = getFallbackSmtpTransport();
    from = fallbackFromAddress();
    usedFallback = Boolean(transport);
  }

  if (!transport) {
    return {
      sent: false,
      skipReason:
        "No outgoing mail configured. Connect Gmail, add SMTP under Settings → Invite mail, or set server SMTP_* fallback.",
    };
  }

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    return { sent: true, id: info.messageId, usedFallback, via: usedFallback ? "server_smtp" : "smtp" };
  } catch (e) {
    return { sent: false, error: e?.message || String(e), usedFallback, via: usedFallback ? "server_smtp" : "smtp" };
  }
}
