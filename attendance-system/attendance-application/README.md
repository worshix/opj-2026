# Attendance Application

Next.js dashboard + API for the RFID attendance system. For hardware setup,
firmware flashing, and day-of-event usage, see the
[repo-root README](../README.md) — this file only covers running the app
itself.

## Development

```bash
pnpm install
pnpm exec prisma migrate dev --name init   # first run only: creates dev.db
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Other commands

```bash
pnpm build   # production build
pnpm start   # run the production build
pnpm lint    # eslint
pnpm exec prisma studio   # browse the local SQLite database
```

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 — dark-only green theme (`app/globals.css`)
- Prisma + SQLite (`prisma/schema.prisma`)
- [sonner](https://sonner.emilkowal.ski/) for the unknown-card toast flow

## API routes (consumed by the ESP32 reader)

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Liveness check for the reader's "App reachable" LED |
| `/api/tap` | POST | Record a single live tap: `{ uid, timestamp? }` |
| `/api/sync` | POST | Replay a batch of queued offline taps: `{ taps: [{ uid, timestamp? }] }` |
| `/api/cards` | GET | All known card UIDs, for the reader's local cache |

Dashboard-facing routes: `/api/students`, `/api/events`,
`/api/events/active`, `/api/events/[id]/end`, `/api/unknown-taps`,
`/api/unknown-taps/[id]/ack`.
