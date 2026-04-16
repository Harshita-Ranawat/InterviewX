import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let initialized = false;

export function initFirebaseAdmin() {
  if (initialized) return admin;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && existsSync(path.resolve(process.cwd(), credPath))) {
    const serviceAccount = JSON.parse(
      readFileSync(path.resolve(process.cwd(), credPath), "utf8")
    );
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    console.warn(
      "[firebase-admin] No credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON."
    );
    return null;
  }
  initialized = true;
  return admin;
}

/** True when Firebase Admin SDK initialized with credentials (auth verify will work). */
export function isFirebaseAdminReady() {
  return initialized && admin.apps.length > 0;
}

export async function verifyFirebaseToken(idToken) {
  const app = initFirebaseAdmin();
  if (!app) throw new Error("Firebase Admin not configured");
  return admin.auth().verifyIdToken(idToken);
}
