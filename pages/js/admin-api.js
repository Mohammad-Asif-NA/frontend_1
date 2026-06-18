/* ============================================================
   api.js — Central API Client
   All HTTP calls to Flask backend go through this file.
   
   USAGE:
     const data = await API.public.settings();
     const token = await API.auth.login(user, pass);
     const inv = await API.inventory.getAll();
   
   To change backend URL: edit API_BASE below or set
   window.API_BASE before loading this script.
   ============================================================ */

/* ── COMPONENT: Base URL
   For local dev:  http://localhost:5000
   For production: your Railway backend URL
   Set this in index.html before loading api.js:
     <script>window.API_BASE = 'https://your-app.railway.app'</script>
   ---------------------------------------------------------- */
const API_BASE = window.API_BASE || 'http://localhost:5000';

/* ── COMPONENT: Token Management
   JWT stored in sessionStorage (cleared on tab close).
   Not localStorage — safer for admin sessions.
   ---------------------------------------------------------- */
const Auth = {
  getToken()       { return sessionStorage.getItem('be_token'); },
  setToken(t)      { sessionStorage.setItem('be_token', t); },
  removeToken()    { sessionStorage.removeItem('be_token'); },
  isLoggedIn()     { return !!this.getToken(); },
};

/* ── COMPONENT: Core Fetch Helper
   Adds auth header automatically if token exists.
   Throws error with server message if response not ok.
   ---------------------------------------------------------- */
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  /* Parse JSON even on error (Flask returns JSON errors) */
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/* ══════════════════════════════════════════════════════════
   SECTION: API NAMESPACES
   ══════════════════════════════════════════════════════════ */
const API = {

  /* ── COMPONENT: Auth Routes ----------------------------- */
  auth: {
    /* Login — returns { token, username } */
    async login(username, password) {
      const data = await apiFetch('/api/auth/login', {
        method : 'POST',
        body   : JSON.stringify({ username, password }),
      });
      Auth.setToken(data.token);
      return data;
    },

    /* Logout — just clears token */
    logout() {
      Auth.removeToken();
    },

    /* Change password */
    async changePassword(currentPassword, newPassword) {
      return apiFetch('/api/auth/change-password', {
        method : 'POST',
        body   : JSON.stringify({
          current_password : currentPassword,
          new_password     : newPassword,
        }),
      });
    },
  },

  /* ── COMPONENT: Public Routes (no auth) ----------------- */
  public: {
    async settings() {
      return apiFetch('/api/public/settings');
    },
    async owner() {
      return apiFetch('/api/public/owner');
    },
  },

  /* ── COMPONENT: Inventory Routes ----------------------- */
  inventory: {
    async getAll(category = null) {
      const q = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
      return apiFetch(`/api/inventory${q}`);
    },
    async add(product) {
      return apiFetch('/api/inventory', {
        method : 'POST',
        body   : JSON.stringify(product),
      });
    },
    async update(id, product) {
      return apiFetch(`/api/inventory/${id}`, {
        method : 'PUT',
        body   : JSON.stringify(product),
      });
    },
    async remove(id) {
      return apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
    },
  },

  /* ── COMPONENT: Sales Routes --------------------------- */
  sales: {
    async getByDate(date) {
      return apiFetch(`/api/sales?date=${date}`);
    },
    async getRecent() {
      return apiFetch('/api/sales');
    },
    async add(sale) {
      return apiFetch('/api/sales', {
        method : 'POST',
        body   : JSON.stringify(sale),
      });
    },
    async remove(id) {
      return apiFetch(`/api/sales/${id}`, { method: 'DELETE' });
    },
    async summary(date) {
      return apiFetch(`/api/sales/summary?date=${date}`);
    },
  },

  /* ── COMPONENT: Settings Routes ------------------------ */
  settings: {
    async getAll() {
      return apiFetch('/api/settings');
    },
    async update(data) {
      return apiFetch('/api/settings', {
        method : 'PUT',
        body   : JSON.stringify(data),
      });
    },
  },

  /* ── COMPONENT: Owner Routes --------------------------- */
  owner: {
    async update(data) {
      return apiFetch('/api/owner', {
        method : 'PUT',
        body   : JSON.stringify(data),
      });
    },
  },
};
