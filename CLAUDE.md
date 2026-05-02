# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm start        # Start production server (requires build first)
```

There are no lint, test, or type-check scripts configured.

## Architecture

This is a **client-side-only** Next.js app. All data flows directly from the browser to Supabase — there are no API routes or server components. The entire app is one React component tree with no routing library.

```
app/tracker.js          ← all UI + state + business logic (single component, ~589 lines)
lib/tracker-db.js       ← thin Supabase query wrappers (5 async functions)
lib/supabase.js         ← Supabase client singleton
app/page.js             ← renders <Tracker />
app/layout.js           ← Google Fonts + metadata
app/globals.css         ← design system (CSS variables, animations)
app/tracker.module.css  ← component-scoped styles
```

## Key Concepts

**Day modes**: Every day is one of three modes — `green` (full focus, 90-min blocks), `yellow` (low-energy fallback, pick one), or `off` (rest day). Mode selection drives the entire UI.

**Task structure (hardcoded in tracker.js)**:
- `GREEN_TASKS`: Three blocks — Block 1 "Technical Depth" (pick-one, 45 min), Block 2 "Visibility" (pick-one, 30 min), Block 3 "Pipeline" (check-all, 15 min)
- `YELLOW_TASKS`: Pick-one from low-energy options
- `WEEKLY_SCHEDULE`: Pre-assigned mode per day of week

**"Done" auto-detection**: A green day is `done` when Block 1 AND Block 2 each have ≥1 item checked. Yellow: any item checked. Off: always done. The `markDone()` button is a manual override.

**Pick-one logic**: When a pick-one item is toggled on, all sibling items in that block are auto-unchecked. This is handled in `toggleItem()`.

**Streak calculation**: Runs entirely in the browser on every state change. Current streak counts consecutive `done: true` days backward from the last 7 days. Longest streak scans full history.

## Database Schema

Two Supabase tables (no migration files — schema must be created manually in Supabase dashboard):

```sql
daily_logs  — date (PK), mode, completed_items (JSON array), done (bool), note_text, updated_at
reviews     — date (PK), q1, q2, q3
```

The `reviews` table stores Sunday reflection answers separately from daily logs.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Both are public (browser-visible). Access control relies on Supabase Row-Level Security, not secret keys.

## Navigation / Views

The app uses a single `view` state (no URL routing) with four screens: `today`, `week`, `rules`, `review`. All state (streak, history) stays loaded when switching views because it's all in one component.

## Branches

- `main` — baseline (very early)
- `production-v1` — last stable release
- `cleanup/refactor-tracker` — current working branch (extracted sub-components and DB layer)
