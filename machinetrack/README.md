# MachineTrack

CNC machine production tracking app. Express + Vite + Drizzle + Passport.

## Stack
- Express 4 (single server, serves API + built Vite client)
- React 18 + Vite + TypeScript + Tailwind
- Drizzle ORM with `pg` driver
- Passport.js (Local + Google OAuth)
- express-session + connect-pg-simple (sessions in Postgres)
- TanStack Query, Wouter, lucide-react, Recharts, sonner

## Setup

```bash
npm install
# Create .env with:
#   DATABASE_URL=postgresql://...
#   SESSION_SECRET=any-long-random-string
#   GOOGLE_CLIENT_ID=... (optional)
#   GOOGLE_CLIENT_SECRET=...
#   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

## Run locally

```bash
# Backend (port 5000)
npm run dev

# Frontend (port 5173 — proxy /api to localhost:5000 in vite.config.ts if needed)
cd client && npx vite
```

For production, run `npm run build && npm start`. Express serves both API and the built client.

## Deploy to Render

The `render.yaml` is ready. Either:
1. Connect your GitHub repo to Render — Render auto-detects `render.yaml`
2. Set `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` in Render dashboard
3. Deploy

Update your Google OAuth Authorized Redirect URI to `https://<your-app>.onrender.com/api/auth/google/callback`.

## Features built

### Server
- Express + session + Passport (Local + Google) + Drizzle + auto-migrations
- Endpoints: /api/login, /api/logout, /api/me, /api/auth/google
- Masters CRUD: machines, items, shifts, operators
- Operator accounts CRUD (admin manages operator login accounts)
- Production entries: GET + POST + DELETE with server-side validation that REJECTS (not silently caps) inputs exceeding target
- Alert thresholds CRUD
- Dashboard aggregation endpoint

### Client pages
- **Login** — Google button + username/password form
- **Dashboard** — KPIs, hourly trend (line chart), output by machine (bar chart), items table
- **Production Entry** — full hourly grid with auto-save (1.5s debounce), per-cell blur-commit, per-hour save buttons, locked hours, KPI bar, shift switcher
- **Masters** — tabbed UI for Machines, Items, Shifts, Operators (all CRUD)
- **Recent Entries** — filterable date-range history with search
- **Reports** — date range + machine/shift filters + CSV export (summary or hourly format)
- **Alerts** — threshold rules CRUD with enable/disable toggles
- **Users** — operator account management

## Architecture decisions

1. **Operators can save production entries.** POST /api/entries uses `isAuthenticated`, not `isAdmin`. Only DELETE requires admin.
2. **Validation rejects, doesn't cap.** If closing - opening > target rate, the server returns 400 with a helpful message.
3. **Inputs commit on blur, not per-keystroke.** Local React state in HourCell + OpeningReadingInput. Snap-back on rejection.
4. **No focus refresh.** Doesn't wipe typed data when users tab away.
5. **Cookies same-origin.** Frontend + backend on same Express server.
6. **Multi-tenant by org.** Every row filtered by `organizationId`.

## Verified
- 27 source files, 0 TypeScript errors
- `npm run build` produces working `dist/index.cjs` + `dist/public/`
