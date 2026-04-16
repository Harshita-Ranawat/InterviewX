import { google } from "googleapis";
import { getInterviewInviteBodies } from "./inviteTemplates.js";
import { gmailOAuthRedirectUri } from "./publicAppUrl.js";

/**
 * Send one invite email using the user's Gmail API (OAuth refresh token).
 * Uses the same Google Cloud OAuth client as the connect flow.
 */
export async function sendInterviewInviteViaGmailOAuth({
  refreshToken,
  sendAsEmail,
  hostLabel,
  to,
  inviteToken,
  interviewTitle,
}) {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return {
      sent: false,
      error: "Server is not configured for Gmail (GOOGLE_GMAIL_CLIENT_ID / GOOGLE_GMAIL_CLIENT_SECRET).",
    };
  }

  const { subject, text, html } = getInterviewInviteBodies({
    to,
    inviteToken,
    interviewTitle,
    hostLabel,
  });

  const name = String(hostLabel || "Interview").replace(/"/g, "'");
  const from = sendAsEmail.includes("<")
    ? sendAsEmail.trim()
    : `"${name}" <${sendAsEmail.trim()}>`;

  const mime = buildRfc822({ from, to, subject, text, html });
  const raw = Buffer.from(mime, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, gmailOAuthRedirectUri());
    oauth2.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    return { sent: true, id: data?.id, via: "gmail" };
  } catch (e) {
    const msg =
      e?.response?.data?.error?.message ||
      e?.errors?.[0]?.message ||
      e?.message ||
      String(e);
    return { sent: false, error: msg, via: "gmail" };
  }
}

function buildRfc822({ from, to, subject, text, html }) {
  const boundary = "inv_" + Math.random().toString(36).slice(2);
  const encSubj = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encSubj}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
