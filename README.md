# Interview Platform

Full-stack interview platform: Firebase authentication, role-based access, scheduled interviews with invites, **AI mock interviews** with OpenAI, **live coding** (Monaco + Socket.io), **WebRTC video**, dashboards, and reports.

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Frontend | React 18, Vite 5, Tailwind CSS, React Router, Monaco Editor, Socket.io client, Firebase Auth |
| Backend | Node.js (ESM), Express, Mongoose, Socket.io, Firebase Admin, OpenAI API, Nodemailer / Gmail API |
| Data & auth | MongoDB, Firebase (web + Admin SDK) |

## Repository layout

```
Interview-Platform/
├── client/          # Vite + React SPA
├── server/          # Express API + Socket.io
└── package.json     # Root scripts (concurrent dev)
```

## Prerequisites

- **Node.js** 18+ recommended  
- **MongoDB** (local URI or Atlas)  
- **Firebase** project (Authentication enabled; web app + service account for the server)  
- **OpenAI API key** (for AI mock interview features)

## Local development

### 1. Install dependencies

```bash
npm run install:all
```

Or install `server` and `client` separately:

```bash
npm install --prefix server && npm install --prefix client
```

### 2. Environment files

Copy the examples and fill in values:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

- **`server/.env`**: See [Server environment variables](#server-environment-variables).  
- **`client/.env`**: Add Firebase web config (`VITE_FIREBASE_*`). For local dev, leave `VITE_API_BASE` empty so Vite proxies `/api` and `/socket.io` to the API (default proxy target: `http://localhost:4000`).

### 3. Firebase Admin (server)

Download a **service account JSON** from Firebase Console → Project settings → Service accounts → **Generate new private key**. Point the server at it (do not commit this file):

```env
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

For hosted backends (e.g. Render), use a single-line JSON env var instead: `FIREBASE_SERVICE_ACCOUNT_JSON` (see `server/.env.example`).

### 4. Run API and UI

Default API port is **4000** (or `PORT` in `server/.env`). Vite defaults to **5173**.

```bash
npm run dev
```

This runs the server and client together via `concurrently`. Alternatively:

```bash
npm run dev:server   # API only
npm run dev:client   # Vite only
```

### 5. Health check

```http
GET http://localhost:4000/health
```

Returns MongoDB and Firebase Admin status. `/health` reports `ready: true` only when MongoDB is connected **and** Firebase Admin is initialized (service account configured).

## Server environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `4000`) |
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `CLIENT_ORIGIN` | Comma-separated browser origins for CORS and Socket.io (include your Vite dev URLs and production frontend URL) |
| `APP_PUBLIC_URL` | Public **frontend** origin (no trailing slash): invite links, Gmail OAuth redirect base (`/oauth/gmail-invite`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (local) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Minified Firebase service account JSON string (production hosts) |
| `INVITE_SMTP_SECRET` | Secret for signing invite tokens (if using invite flows) |
| `GOOGLE_GMAIL_CLIENT_ID` / `GOOGLE_GMAIL_CLIENT_SECRET` | Gmail OAuth (optional; for sending mail via Gmail API) |
| `SMTP_*` | Optional fallback SMTP |

Full template: `server/.env.example`.

## Client environment variables

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_*` | Firebase web app config from Firebase Console |
| `VITE_API_BASE` | **Production:** full URL of the API (no trailing slash), e.g. `https://your-api.onrender.com`. **Local dev:** leave empty to use the Vite proxy |
| `VITE_DEV_PROXY_TARGET` | Dev-only: API base for proxy (default `http://localhost:4000`) |
| `VITE_DEV_PORT` | Optional Vite dev server port |

Template: `client/.env.example`.

## Production deployment (example: Vercel + Render)

Typical split:

1. **Frontend (e.g. Vercel)**  
   - Root / build: `client`, install command as needed, build `npm run build`, output `dist`.  
   - Set `VITE_API_BASE` to your public API URL **or** rely on `client/.env.production` committed for build-time injection.  
   - Add your Vercel domain under Firebase → Authentication → **Authorized domains**.

2. **Backend (e.g. Render)**  
   - Start command: `npm start` in `server`.  
   - Set `MONGODB_URI`, `OPENAI_API_KEY`, `CLIENT_ORIGIN` (include your Vercel origin), `APP_PUBLIC_URL` (your Vercel URL, no trailing slash), and `FIREBASE_SERVICE_ACCOUNT_JSON` (minified service account JSON).  
   - Do **not** commit service account keys; set them only in the host’s environment.

3. **Google Cloud (if using Gmail OAuth for invites)**  
   - Authorized redirect URI: `{APP_PUBLIC_URL}/oauth/gmail-invite` (must match the deployed frontend).

Replace hostnames in `client/.env.production` and `server/.env.example` comments with your own URLs when you fork or redeploy.

## Root npm scripts

| Script | Command |
|--------|---------|
| `install:all` | Install `server` and `client` dependencies |
| `dev` | Run API and Vite together |
| `dev:server` | API only |
| `dev:client` | Client only |

## Security notes

- Never commit `server/.env`, `client/.env`, or `firebase-service-account.json`.  
- Rotate Firebase and OpenAI keys if they are ever exposed.  
- Keep `INVITE_SMTP_SECRET` and OAuth secrets only in secure environment storage.

## License

Private / unlicensed unless you add a `LICENSE` file.
