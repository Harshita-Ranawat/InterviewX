/**
 * Public web app origin (no trailing slash). Used in invite links and OAuth redirect URIs.
 */
export function getPublicAppBaseUrl() {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const first = process.env.CLIENT_ORIGIN?.split(",")?.[0]?.trim();
  if (first) return first.replace(/\/$/, "");
  return "http://localhost:5173";
}

export function gmailOAuthRedirectUri() {
  return `${getPublicAppBaseUrl()}/oauth/gmail-invite`;
}
