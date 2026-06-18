/* ============================================================
   main.js — Shared Logic for ALL Public Pages
   Include AFTER api.js and loader.js, on every page.
   
   Handles:
   - Mobile hamburger menu
   - Search bar (redirects to shop.html?q=...)
   - Populating settings (phone, address, hours) from API
   - Toast notifications
   - WhatsApp link helper
   ============================================================ */

'use strict';

let _siteSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
  Nav.init();
  Toast.init();
  await Site.loadSettings();
  Search.init();
});

/* ══════════════════════════════════════════════════════════
   SECTION: NAV
   Mobile hamburger toggle + active link highlight (already
   set via class="active" per-page in HTML).
   ══════════════════════════════════════════════════════════ */
const Nav = {
  init() {
    const hamburger = document.getElementById('navHamburger');
    const links      = document.getElementById('navLinks');
    if (!hamburger || !links) return;

    hamburger.addEventListener('click', () => links.classList.toggle('open'));

    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }
};

/* ══════════════════════════════════════════════════════════
   SECTION: SITE SETTINGS
   Loads shop info from API and populates any element with
   a [data-setting="key"] attribute. Also wires up tel:/mailto:/
   WhatsApp links automatically.
   ══════════════════════════════════════════════════════════ */
const Site = {
  async loadSettings() {
    try {
      _siteSettings = await API.public.settings();
      this.populate();
    } catch (err) {
      console.error('Failed to load settings:', err);
      /* Page still works with placeholder text in HTML */
    }
  },

  populate() {
    const s = _siteSettings;

    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (s[key]) el.textContent = s[key];
    });

    document.querySelectorAll('[data-setting-href="phone"]').forEach(a => {
      if (s.phone) a.href = 'tel:' + s.phone.replace(/\s/g, '');
    });

    document.querySelectorAll('[data-setting-href="email"]').forEach(a => {
      if (s.email) a.href = 'mailto:' + s.email;
    });

    document.querySelectorAll('[data-setting-href="whatsapp"]').forEach(a => {
      a.href = Site.whatsappLink();
    });

    /* Store open/closed indicator, if present */
    const statusEl = document.querySelector('[data-store-status]');
    if (statusEl && s.store_open !== undefined) {
      statusEl.textContent = s.store_open === 'true' ? 'Open now' : 'Closed';
    }
  },

  /* Build a WhatsApp deep link with optional pre-filled message */
  whatsappLink(message) {
    const num = (_siteSettings.whatsapp || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      message || 'Hi! I visited your website and wanted to enquire about your products.'
    );
    return `https://wa.me/${num}?text=${msg}`;
  },

  getSettings() {
    return _siteSettings;
  }
};

/* ══════════════════════════════════════════════════════════
   SECTION: SEARCH
   The search row on every page. Typing + Enter (or clicking
   the box) redirects to shop.html with a ?q= query param.
   shop.html reads this param on load and pre-fills its own
   search box + filters the product grid.
   ══════════════════════════════════════════════════════════ */
const Search = {
  init() {
    const input = document.getElementById('siteSearch');
    if (!input) return;

    /* If we're already on shop.html, let shop.js handle live filtering
       instead of redirecting. */
    const onShopPage = window.location.pathname.endsWith('shop.html');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !onShopPage) {
        this.goToShop(input.value);
      }
    });

    /* Prefill from ?q= if present (used when landing on shop.html) */
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) input.value = q;
  },

  goToShop(query) {
    const q = encodeURIComponent(query.trim());
    window.location.href = q ? `shop.html?q=${q}` : 'shop.html';
  }
};

/* ══════════════════════════════════════════════════════════
   SECTION: TOAST
   Usage: Toast.show('Message', 'success' | 'error' | 'info')
   ══════════════════════════════════════════════════════════ */
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.id = 'toastContainer';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(60px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

/* ── COMPONENT: Generic WhatsApp button handler
   Any element with [data-whatsapp-product="Product Name"]
   opens WhatsApp with a message mentioning that product.
   ---------------------------------------------------------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-whatsapp-product]');
  if (!btn) return;
  const productName = btn.dataset.whatsappProduct;
  const msg = `Hi! I'm interested in the ${productName}. Can you share more details?`;
  window.open(Site.whatsappLink(msg), '_blank');
});

/* ── COMPONENT: Smooth scroll for in-page anchors -------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (target) {
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
