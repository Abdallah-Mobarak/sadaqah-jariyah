# Sadaqah Jariyah — Read & Dedicate the Reward

A simple, respectful website where people read Quran, adhkar, tasbeeh, and pray for
their deceased loved ones — intending the reward to reach them, God willing.
Visitors use it **without any login**: they read, count tasbeeh, or write a dua themselves.

> Intentional note: the counters track **people's participation** (how many read/prayed),
> not a "good-deeds meter". The reward is earned by intention and real action;
> the site is only a tool that helps.

> The interface and content are in **Arabic** by design (it serves an Arabic audience).
> Code, comments, and docs are in English.

## Features
- 📖 Online Quran reader (via the alquran.cloud API).
- 🌙 Morning & evening adhkar, with a counter per dhikr.
- 📿 Electronic tasbeeh with multiple phrases.
- 🤍 "Salah upon the Prophet ﷺ" counter.
- 🕌 Prayer times by city or current location.
- 🤲 "Pray for them" section where visitors write duas (with heart likes).
- ➕ Anyone can submit a deceased (name + photo + note + chosen deeds).
- ✅ Nothing is published until the admin approves it from the dashboard.
- 🟢 Easy sharing via WhatsApp and copy link.

## Run locally
```bash
npm install
npm run seed     # (optional) sample data for the first run
npm start        # or: npm run dev  for auto-restart while developing
```
Then open: http://localhost:3000

**Admin dashboard:** http://localhost:3000/admin
Default password: `admin1234` (change it via `.env`).

## Configuration (.env)
Copy `.env.example` to `.env` and edit the values:
```
PORT=3000
NODE_ENV=development
ADMIN_PASSWORD=a-strong-password
SESSION_SECRET=a-long-random-string
SECURE_COOKIES=false
```

## Where is data stored?
- Deceased entries and duas: `data/db.json` (created automatically).
- Uploaded photos: `public/uploads/`.
To back up, save just these two locations. (Both are git-ignored on purpose.)

## ✅ Before going to production
1. Create a `.env` on the server with:
   - `NODE_ENV=production`
   - `ADMIN_PASSWORD` = a strong password.
   - `SESSION_SECRET` = a long random string (e.g. `openssl rand -hex 32`).
   - `SECURE_COOKIES=true` **only if** your site is served over HTTPS (otherwise login breaks).
2. Make sure `public/uploads/` and `data/` are writable.
3. Use hosting with a **persistent disk** (VPS / Railway+Volume / cPanel) — not Vercel,
   which wipes uploaded files.
4. Prefer running behind a reverse proxy (nginx) with HTTPS and a process manager like `pm2`.

## Deploying
A plain Node app that runs on any Node-capable host:
1. Upload everything **except** `node_modules`, `.env`, and `data/db.json`.
2. `npm install --omit=dev`
3. Set the `.env` values listed above.
4. Start command: `npm start` (entry point `server.js`).

## Project structure
```
server.js            # Express server and all routes
config.js            # all settings in one place
middleware.js        # security headers + rate limiting
db/store.js          # simple, safe JSON storage
db/seed.js           # sample data
data/adhkar.json     # morning/evening adhkar text
views/               # EJS templates (pages + tools + admin)
public/css/style.css # styling
public/js/main.js    # frontend interactions
public/uploads/      # uploaded photos (git-ignored)
```

## Technical notes
- No database and no native modules — JSON storage works on any host.
- Basic hardening: security headers, `httpOnly` session cookie, and rate limiting on submissions.
- Health check: `GET /healthz`.

## License
MIT — see [LICENSE](LICENSE).
