# Momentum v2 — private multi-user goal tracker

## Run locally (Windows / PowerShell)
1. Install Python 3.11+, Node.js 20+, and Docker Desktop.
2. In the project root run `docker compose up -d db`.
3. Backend terminal: `cd backend`; `py -m venv .venv`; ` .\.venv\Scripts\Activate.ps1`; `pip install -r requirements.txt`; `Copy-Item .env.example .env`.
4. Generate a secret with `py -c "import secrets; print(secrets.token_urlsafe(48))"`, then put it in `backend/.env` as `JWT_SECRET=...`. Start `uvicorn app.main:app --reload --port 8000`. API docs: http://localhost:8000/docs.
5. Frontend terminal: `cd frontend`; `npm install`; `npm run dev`.

The frontend includes registration/login and sends bearer tokens to the secured API. The API uses Argon2 password hashes, per-user ownership checks, linked goals/tasks/milestones, completion event history, and analytics. Access tokens are kept in sessionStorage for the browser session. For a public production deployment, prefer secure HttpOnly cookies with appropriate CSRF protection, add password reset/email verification, migrations, automated tests, HTTPS, backups, rate limiting, and production secrets management. Do not expose PostgreSQL publicly. Existing v1 database tables are not migrated automatically; use a fresh local database for this v2 schema.
