# Bharat Electronics — v3 (Multi-page, Light Theme)

This is a full redesign of the public-facing site, built on top of the
SAME backend (Flask + MySQL on Railway) you already deployed. Nothing
on the backend needs to change — only the frontend folder is replaced.

---

## What's New in v3

- **5 separate pages** instead of one long scrolling page:
  `index.html` (Home), `shop.html` (full catalog), `repair.html`
  (booking form), `about.html` (owner story), `contact.html`
  (enquiry form + delivery info)
- **Light theme** — white/cream background, black nav, yellow +
  green accent colors (was dark gold theme before)
- **No Admin button on public pages** — the dashboard is only
  reachable if you know the URL: `pages/login.html`
- **Search bar** has its own row under the nav on every page, and
  works across pages (typing on Home + Enter jumps to Shop with
  results filtered)
- **BE → Bharat Electronics** loader animation plays briefly on
  every page load
- **Repair booking form** and **Contact enquiry form** both submit
  to your existing `/api/customers` endpoint — so submissions will
  appear in your database immediately (a dashboard tab to *view*
  them isn't built yet — see "Next Steps" below)

---

## File Structure

```
bharat-v3/
├── index.html          ← Home
├── shop.html            ← Full product catalog
├── repair.html            ← Repair service booking
├── about.html              ← Owner story + timeline
├── contact.html             ← Contact form + delivery info
├── css/
│   ├── common.css          ← Shared: nav, footer, buttons, cards (LIGHT theme)
│   └── pages.css            ← Page-specific: hero banner, forms, timeline
├── js/
│   ├── config.js             ← ⚠️ SET YOUR RAILWAY URL HERE
│   ├── api.js                  ← Public API client (no login needed)
│   ├── loader.js                ← BE animation logic
│   └── main.js                    ← Nav, search, settings, toast
└── pages/                          ← ADMIN — untouched dark theme
    ├── login.html
    ├── dashboard.html
    ├── css/
    │   ├── admin-common.css        ← Admin's own dark/gold theme
    │   └── dashboard.css
    └── js/
        ├── config.js
        ├── admin-api.js             ← Has JWT auth (login required)
        └── dashboard-api.js
```

**Important:** the public site (`css/common.css`, `js/api.js`) and the
admin dashboard (`pages/css/admin-common.css`, `pages/js/admin-api.js`)
are completely separate files now, even though both are named
similarly. This is intentional — the public site is light-themed and
needs no login; the dashboard stays dark-themed and requires a JWT
token. Don't mix them up when editing.

---

## Before You Deploy

Update your Railway backend URL in **two** places:

1. `js/config.js` (line: `API_BASE: '...'`)
2. `pages/js/config.js` (same line)

Both should point to your existing Railway URL, e.g.:
```js
API_BASE: 'https://web-production-2f551.up.railway.app',
```

---

## Deploy (same as before)

1. Push this whole `bharat-v3` folder to your
   `bharat-electronics-frontend` GitHub repo (replacing old contents)
2. Netlify will auto-redeploy from the connected repo
3. Your Railway backend doesn't need any changes — same database,
   same API routes

---

## Next Steps (Not Built Yet)

- **Dashboard tab to view customer enquiries/repair requests** —
  right now submissions save to the `customers` table but there's
  no UI in the dashboard to read them. You'd need to check the
  database directly (Railway → MySQL → Data tab) until this is added.
- **Real Google Maps embed** — the "Get Directions" buttons link to
  your Google Maps URL but don't show an embedded map preview.
- **Product detail pages** — clicking "View details" currently
  triggers a WhatsApp message; there's no individual product page yet.
