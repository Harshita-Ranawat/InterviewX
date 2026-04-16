import { getPublicAppBaseUrl } from "./publicAppUrl.js";

export function getInterviewInviteBodies({ to, inviteToken, interviewTitle, hostLabel }) {
  const base = getPublicAppBaseUrl();
  const inviteUrl = `${base}/invite/${inviteToken}`;
  const host = hostLabel || "The host";

  const subject = `Interview invite: ${interviewTitle}`;

  const text = [
    `${host} invited you to an interview: "${interviewTitle}".`,
    "",
    `Open this link to accept (sign in with the same email: ${to}):`,
    inviteUrl,
    "",
    `If the button does not work, copy and paste the URL into your browser.`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;">
  <p><strong>${escapeHtml(host)}</strong> invited you to: <strong>${escapeHtml(interviewTitle)}</strong></p>
  <p>Sign in with <strong>${escapeHtml(to)}</strong>, then open:</p>
  <p><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;margin:12px 0;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">Accept invite</a></p>
  <p style="font-size:12px;color:#64748b;word-break:break-all;">${escapeHtml(inviteUrl)}</p>
</body>
</html>`;

  return { subject, text, html, inviteUrl };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
