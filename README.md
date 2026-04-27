# Daily Tracker

Green day. Yellow day. Streak alive.

## Deploy to Vercel in 3 steps

### Option A — Vercel CLI (fastest)

```bash
# 1. Install dependencies
npm install

# 2. Install Vercel CLI (one time)
npm install -g vercel

# 3. Deploy
vercel
```

Follow the prompts. Your app will be live at a `*.vercel.app` URL in under 2 minutes.

---

### Option B — GitHub + Vercel (recommended for ongoing use)

1. Push this folder to a new GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Select the repo → Deploy

Done. Every push to `main` auto-deploys.

---

## Local dev

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Notes

- All data is saved to `localStorage` — no backend, no account needed
- Works on mobile (bookmark it to your home screen)
- Data persists in the browser you use — if you clear browser data, it resets
