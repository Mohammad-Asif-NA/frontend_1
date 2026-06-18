/* ============================================================
   api.js — API Client (Public Pages)
   Used by: index.html, shop.html, repair.html, about.html, contact.html
   
   These pages don't need login — only public + customer-submit
   endpoints are used here. Admin dashboard has its own api.js
   in /pages/ (unchanged from before).
   ============================================================ */

const API_BASE = window.API_BASE || 'http://localhost:5000';

/* ── COMPONENT: Core Fetch Helper
   ---------------------------------------------------------- */
async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ══════════════════════════════════════════════════════════
   PUBLIC API — no auth required
   ══════════════════════════════════════════════════════════ */
const API = {

  public: {
    async settings() {
      return apiFetch('/api/public/settings');
    },
    async owner() {
      return apiFetch('/api/public/owner');
    },
  },

  inventory: {
    async getAll(category = null) {
      const q = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
      return apiFetch(`/api/inventory${q}`);
    },
  },

  /* ── Customer enquiry / repair booking
     Both use the same /api/customers endpoint, with the
     'message' field formatted differently depending on form.
     -------------------------------------------------------- */
  customers: {
    async submit({ name, phone, email, message }) {
      return apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, message }),
      });
    },
  },
};
