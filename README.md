# Momentum v2 — private multi-user goal tracker

## Run locally (Windows / PowerShell)
1. Install Python 3.11+, Node.js 20+, and Docker Desktop.
2. In the project root run `docker compose up -d db`.
3. Backend terminal: `cd backend`; `py -m venv .venv`; ` .\.venv\Scripts\Activate.ps1`; `pip install -r requirements.txt`; `Copy-Item .env.example .env`.
4. Generate a secret with `py -c "import secrets; print(secrets.token_urlsafe(48))"`, then put it in `backend/.env` as `JWT_SECRET=...`. Start `uvicorn app.main:app --reload --port 8000`. API docs: http://localhost:8000/docs.
5. Frontend terminal: `cd frontend`; `npm install`; `npm run dev`.

The frontend includes registration/login and sends bearer tokens to the secured API. The API uses Argon2 password hashes, per-user ownership checks, linked goals/tasks/milestones, completion event history, and analytics. Access tokens are kept in sessionStorage for the browser session. For a public production deployment, prefer secure HttpOnly cookies with appropriate CSRF protection, add password reset/email verification, migrations, automated tests, HTTPS, backups, rate limiting, and production secrets management. Do not expose PostgreSQL publicly. Existing v1 database tables are not migrated automatically; use a fresh local database for this v2 schema.

## Google OAuth (production)

Google sign-in is optional and does not replace email/password login or password reset.

1. In Google Cloud Console, create/select a project and configure the OAuth consent screen. Add the app name and support email; while the app is in Testing, add the Google accounts allowed to test it.
2. Create an OAuth client ID of type **Web application**.
3. Add this exact **Authorized redirect URI**: `https://aimit-t4ce.onrender.com/auth/google/callback`.
4. In Render, set these backend environment variables (keep all secrets in Render, never in GitHub or the frontend):
   - `GOOGLE_CLIENT_ID` — the client ID from Google Cloud Console.
   - `GOOGLE_CLIENT_SECRET` — the client secret from Google Cloud Console.
   - `GOOGLE_REDIRECT_URI=https://aimit-t4ce.onrender.com/auth/google/callback`
   - `FRONTEND_URL=https://aim-it-six.vercel.app`
   - `SESSION_SECRET` — a new, long random secret, different from `JWT_SECRET`.
   - `JWT_SECRET` — keep the existing strong production value; do not rotate it casually because it invalidates current access tokens.
   - `APP_ENV=production`
5. Save the variables and let Render redeploy. The backend installs Authlib from `backend/requirements.txt`.
6. Open the Vercel app and choose **Continue with Google**. Test with a Google account allowed by the consent-screen publishing/testing settings.

If you use a different Vercel or Render URL later, update `FRONTEND_URL` and the exact Google authorized redirect URI. Never paste OAuth client secrets into chat, frontend environment variables, or committed files.

Google sign-in creates a normal AimIt user record when the verified Google email is new. If that email already has an AimIt account, Google sign-in uses that existing account, preserving its goals and targets. Existing email/password login and password-reset endpoints remain available.
