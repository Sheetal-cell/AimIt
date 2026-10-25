# AimIt — Personal Goals, Daily Focus & Progress Tracker

> Turn long-term goals into focused daily action. AimIt is a full-stack productivity app for planning goals, managing daily targets, tracking consistency, and reviewing completion history.

**Live app:** https://aim-it-six.vercel.app/  
**API health:** https://aimit-t4ce.onrender.com/health  
**Interactive API docs:** https://aimit-t4ce.onrender.com/docs  
**Source:** https://github.com/Sheetal-cell/AimIt

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Application flow](#application-flow)
- [Database design](#database-design)
- [API overview](#api-overview)
- [Run locally from a fresh clone](#run-locally-from-a-fresh-clone)
- [Environment variables](#environment-variables)
- [Google OAuth setup](#google-oauth-setup)
- [Excel export](#excel-export)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Security and production notes](#security-and-production-notes)
- [Roadmap](#roadmap)

## Overview

AimIt connects big-picture goals with practical daily action. Users can organise goals, break them into milestones, plan a week, choose their top three priorities, complete tasks, and review progress over time.

The system is split into a React frontend, a FastAPI REST backend, and a PostgreSQL relational database. Authentication and data access are handled by the backend; user-owned records are queried in the context of the authenticated account.

## Features

### Planning and productivity
- Create goals, organise them by category, and set optional target dates.
- Break goals into milestones and update milestone status.
- Create, edit, complete, and delete tasks with due dates, priority, estimated minutes, notes, and optional goal links.
- Schedule recurring tasks daily, on weekdays, or weekly across a date range.
- Use a seven-day planner to navigate the week and focus on a selected date.
- Save a daily Top 3 priority list.
- Review dashboard metrics, including today's completion, goals, milestones, overdue tasks, and upcoming targets.
- Inspect a selected day's task history and a consistency calendar/streak.
- Use a focus stopwatch.
- Define personal daily and weekly rewards.

### Accounts and personalisation
- Email/password registration and login.
- Google OAuth / OpenID Connect sign-in.
- Password reset and signed-in password change.
- Profile page with account information and selectable colour themes.
- Google profile photo when Google supplies a valid picture URL; initials are used as a fallback.
- Account deletion.
- Per-user data ownership enforced in backend routes.

### Reports
- Download task history as an Excel workbook (.xlsx).
- Quick presets for this week and the last seven days.
- Choose custom start and end dates.
- Include task title, due date, completion status, completion timestamp, priority, estimated minutes, and notes.

## Architecture

~~~mermaid
flowchart TD
    USER[User / Browser] -->|HTTPS| FE[React + TypeScript + Vite]
    FE -->|REST / JSON + Bearer token| API[FastAPI REST API]
    FE -->|OAuth redirect| GOOGLE[Google OAuth / OpenID Connect]
    GOOGLE -->|Verified identity callback| API
    API -->|SQLAlchemy ORM| DB[(PostgreSQL)]
    API -->|OpenPyXL| XLSX[In-memory Excel workbook]
    XLSX -->|File response| FE
    FE --> VERCEL[Vercel frontend hosting]
    API --> RENDER[Render backend hosting]
~~~

### Request lifecycle

1. The browser loads the frontend from Vercel (or the local Vite server).
2. The frontend sends REST requests to FastAPI. Protected requests include an Authorization Bearer token.
3. FastAPI validates the token and resolves the current user.
4. SQLAlchemy reads or updates PostgreSQL records, scoped to that user's ID.
5. The API returns JSON for normal requests or streams an Excel workbook for a report.
6. Google sign-in redirects to Google and back to the backend callback. The backend validates the verified email and issues an AimIt access token.

## Technology stack

| Layer | Stack | Purpose |
|---|---|---|
| Frontend | React, TypeScript, Vite | UI components, app state, local dev server and production build |
| Styling | CSS | Responsive layouts, cards, themes, and interaction states |
| Icons | Lucide React | Interface icons |
| Backend | Python, FastAPI | REST endpoints, dependencies, validation, and interactive API docs |
| Schemas | Pydantic via FastAPI | Validate request bodies and response structures |
| ORM | SQLAlchemy | Database models, queries, and transactions |
| Database | PostgreSQL | Persistent relational application data |
| Authentication | JWT access tokens, password hashing, Authlib, Google OAuth/OIDC | Sign-in and protected API access |
| Excel | OpenPyXL | Generate .xlsx reports |
| Local development | Docker Compose | Run PostgreSQL locally |
| Hosting | Vercel and Render | Deploy frontend and backend separately |

## Project structure

~~~text
AimIt/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes, authentication, reports, app logic
│   │   ├── models.py        # SQLAlchemy models and relationships
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── database.py      # SQLAlchemy engine, sessions, Base
│   │   └── security.py      # Password hashing, JWT creation and validation
│   ├── .env.example         # Backend environment template
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React application and feature views
│   │   ├── main.tsx         # React entry point
│   │   └── styles.css       # App styles and responsive themes
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml       # Local PostgreSQL service
├── README.md
└── README_project.md
~~~

## Application flow and implementation

### Authentication
- Email/password credentials are checked by the backend; passwords are stored as hashes.
- Google sign-in uses an OAuth/OpenID Connect callback and requires a verified Google email.
- The backend issues an access token. The frontend keeps it in browser sessionStorage and sends it in the Authorization header for protected requests.
- The current-user dependency identifies the authenticated account. Resource routes should validate ownership rather than trust a record ID supplied by the client.
- The Google picture URL is passed through the OAuth return URL fragment and cached in sessionStorage for that browser session. It is not yet a permanent profile field in PostgreSQL.

### Goals, tasks and progress
- Goals represent longer-term outcomes.
- Milestones represent checkpoints within a goal.
- Tasks are dated action items with priority, estimated duration, optional notes, completion state and optional goal association.
- Dashboard and history views calculate completion metrics from saved records.
- CompletionEvent records support completion-change history.
- Top 3 priorities are stored in browser localStorage by user ID and date, not in PostgreSQL.
- Theme preference is also stored in localStorage.

### Excel reports
- The frontend calls the protected report endpoint with a start and end date.
- The backend filters tasks by authenticated user and inclusive due-date range.
- OpenPyXL creates a workbook in memory and FastAPI streams it as an attachment.
- The allowed date range is limited to 366 days.

## Database design

| Model / table | Purpose | Relationships |
|---|---|---|
| User / users | Account identity, email, password hash, display name | Owns user data and reset tokens |
| Goal / goals | Long-term goal and target date | Belongs to a user; can have tasks and milestones |
| Task / tasks | Dated action item and completion state | Belongs to a user; can link to a goal |
| Milestone / milestones | Goal checkpoint | Belongs to a user and goal |
| CompletionEvent / completion_events | Task completion-change history | References user and task |
| Reward / rewards | Daily or weekly reward text | Unique per user, period type, and period start |
| PasswordResetToken / password_reset_tokens | Time-limited reset token record | Belongs to a user |

Foreign keys and cascade rules are configured in the SQLAlchemy models. The backend creates missing tables at startup; this is convenient for this project, but production schema changes should use a migration tool such as Alembic.

## API overview

For the complete schemas and interactive request examples, open the [Swagger UI](https://aimit-t4ce.onrender.com/docs).

| Area | Routes | Purpose |
|---|---|---|
| Health | GET /health | Service health check |
| Authentication | POST /auth/register, POST /auth/login, GET /auth/me | Register, login, current user |
| Google | GET /auth/google/login, GET /auth/google/callback | OAuth sign-in |
| Passwords | POST /auth/forgot-password, POST /auth/reset-password, POST /auth/change-password | Reset or change password |
| Account | DELETE /auth/account | Delete signed-in account |
| Dashboard | GET /dashboard | Summary metrics |
| Goals | /goals and goal-specific routes | Create and manage goals |
| Tasks | /tasks and task-specific routes | Create, edit, complete, and remove tasks |
| Milestones | /milestones and milestone-specific routes | Manage goal checkpoints |
| Rewards | /rewards and period-specific routes | Save and retrieve rewards |
| Reports | GET /reports/tasks.xlsx?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD | Download task report |

Protected routes require an Authorization Bearer token. The report dates are inclusive.

## Run locally from a fresh clone

### Prerequisites

Install Git, Python 3.11+, Node.js 20+ (includes npm), and Docker Desktop with Docker Compose. Alternatively, use a PostgreSQL server you manage yourself.

### 1. Clone the repository

Open PowerShell or a terminal:

~~~powershell
git clone https://github.com/Sheetal-cell/AimIt.git
cd AimIt
~~~

### 2. Start PostgreSQL

From the repository root:

~~~powershell
docker compose up -d db
docker compose ps
~~~

Keep Docker Desktop running while you use AimIt. If you already have PostgreSQL installed, configure DATABASE_URL in the backend environment file instead.

### 3. Install and configure the backend

Open a first terminal at the repository root:

~~~powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
~~~

Open backend/.env in VS Code. Generate a strong local JWT secret:

~~~powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
~~~

Paste the result as the JWT_SECRET value in backend/.env. For local email/password development, Google OAuth variables can remain empty. Check that DATABASE_URL points to the PostgreSQL database started in step 2.

Start the API from inside the backend directory:

~~~powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
~~~

Check http://127.0.0.1:8000/health and open http://127.0.0.1:8000/docs for interactive API documentation. Keep this terminal open.

**If PowerShell blocks activation**, run the following in that terminal and activate the environment again:

~~~powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
~~~

This changes execution policy only for the current PowerShell process.

### 4. Install and start the frontend

Open a second terminal at the repository root:

~~~powershell
cd frontend
npm install
~~~

Create frontend/.env.local with this setting:

~~~dotenv
VITE_API_URL=http://127.0.0.1:8000
~~~

Then start Vite:

~~~powershell
npm run dev
~~~

Open the local URL printed by Vite, usually http://localhost:5173. Keep both frontend and backend terminals running.

### 5. Smoke-test the app

1. Register a test account or sign in.
2. Create a goal and a task.
3. Mark a task complete and check the dashboard.
4. Open Profile and test an Excel export.
5. Open /docs and inspect the available API routes.

## Environment variables

Use backend/.env.example as the source of truth for backend variable names.

| Variable | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | Signs access tokens; use a strong unique value |
| SESSION_SECRET | Signs temporary OAuth session state; keep separate from JWT_SECRET |
| APP_ENV | Set to production in production for secure session cookies |
| FRONTEND_URL | Frontend URL used for OAuth redirects |
| GOOGLE_CLIENT_ID | Google OAuth web client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret; backend only |
| GOOGLE_REDIRECT_URI | Exact backend OAuth callback URL |
| VITE_API_URL | Frontend API base URL; configured in frontend environment |

Never commit .env files or real secrets. Anything prefixed with VITE_ is bundled into browser code and must not contain private credentials.

## Google OAuth setup

Google sign-in is optional for local development; email/password authentication remains available.

1. In Google Cloud Console, select or create a project.
2. Configure the OAuth consent screen. Add test users if the app remains in Testing mode.
3. Create an OAuth client with type Web application.
4. Add this exact authorised redirect URI: https://aimit-t4ce.onrender.com/auth/google/callback
5. In Render, configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL, SESSION_SECRET, JWT_SECRET, and APP_ENV.
6. Set GOOGLE_REDIRECT_URI to the callback above and FRONTEND_URL to https://aim-it-six.vercel.app.
7. Redeploy the backend, then test Continue with Google from the live frontend.

Google must return a verified email. If that email already belongs to an AimIt account, the existing account is reused. Never put the Google client secret in frontend environment variables or commit it to GitHub.

## Excel export

The Profile page provides quick presets for this week and the last seven days, plus custom dates. The backend endpoint is:

~~~http
GET /reports/tasks.xlsx?start_date=2026-10-19&end_date=2026-10-25
Authorization: Bearer <access-token>
~~~

The workbook contains one row per task due in the selected inclusive date range. It includes completion status and timestamp when available. The endpoint is authenticated, user-scoped, and limits a request to a date range of 366 days or less.

## Deployment

### Frontend — Vercel
1. Import this GitHub repository into Vercel.
2. Set the project Root Directory to frontend.
3. Set VITE_API_URL to https://aimit-t4ce.onrender.com.
4. Use npm run build as the build command and dist as the output directory.
5. Redeploy after changing environment variables; Vite values are embedded at build time.

### Backend — Render
1. Create a Python web service connected to this repository.
2. Set the Root Directory to backend.
3. Build/install command: pip install -r requirements.txt.
4. Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT.
5. Set DATABASE_URL to a persistent PostgreSQL connection string and configure the secrets listed above.
6. Check /health and review Render logs after deployment.

Use persistent managed PostgreSQL for production data. Do not rely on an ephemeral filesystem or temporary local database for durable user records.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Frontend cannot connect | Backend status, VITE_API_URL, and CORS origin |
| Database errors | Docker/PostgreSQL status, DATABASE_URL, credentials, database name, network access |
| Google sign-in fails | OAuth consent/test users, exact callback URL, Render variables and logs |
| Google photo missing | Sign out and sign in with Google again; check whether Google returns a picture URL; the UI falls back to an initial if the image fails |
| Excel export fails | Authentication token, date range, backend logs, OpenPyXL installation |
| Live site has old code | GitHub commit and latest Vercel/Render deployment status |

## Security and production notes

- Never commit environment files, database credentials, JWT secrets, or OAuth secrets.
- Use HTTPS for public deployments and keep PostgreSQL private.
- Keep password hashes and access tokens protected.
- The current frontend stores the access token in sessionStorage. HttpOnly cookies with CSRF protection are a possible hardening improvement.
- Add automated tests, rate limiting, monitoring, regular backups, and database migrations before depending on the app for critical data.
- Account deletion is destructive; export or back up any data you need first.

## Roadmap

- Persist Google profile image URLs in the user table and refresh them at sign-in.
- Add Alembic database migrations and automated backend/frontend tests.
- Add import and restore workflows for reports.
- Improve token lifecycle and session security.
- Add end-to-end and accessibility tests.

---

Built to make consistent progress manageable: set the direction, choose today's priorities, and keep showing up.
