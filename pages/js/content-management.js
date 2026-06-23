/* ============================================================
   content-management.js — Dashboard Content Management
   Powers 4 tabs: Hero Banner, Repair Services, Delivery Info,
   Trust Strip — lets the admin edit these without touching
   code. Depends on: admin-api.js (API object), dashboard-api.js
   (showToast, setText helpers — loaded before this file).
   ============================================================ */

let _repairServices = [];
let _deliveryCards   = [];
let _trustItems        = [];

/* ══════════════════════════════════════════════════════════
   SECTION: HERO BANNER
   Single-row data, stored as hero_* keys in the settings
   table. Reuses the same /api/settings PUT endpoint as the
   rest of Settings — just a different set of keys.
   ══════════════════════════════════════════════════════════ */
async function loadHeroBannerTab() {
  try {
    const settings = await API.settings.getAll();
    setVal('hero-tag',             settings.hero_tag);
    setVal('hero-title',           settings.hero_title);
    setVal('hero-description',     settings.hero_description);
    setVal('hero-category-link',   settings.hero_category_link);

    const btn = document.getElementById('save-hero-btn');
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', saveHeroBanner);
      btn.dataset.bound = 'true'; /* avoid double-binding on repeat tab visits */
    }
  } catch (e) {
    console.error('Hero banner load error:', e);
    showToast('Could not load hero banner', 'error');
  }
}

async function saveHeroBanner() {
  const data = {
    hero_tag:           document.getElementById('hero-tag')?.value.trim()           || '',
    hero_title:         document.getElementById('hero-title')?.value.trim()         || '',
    hero_description:   document.getElementById('hero-description')?.value.trim()   || '',
    hero_category_link: document.getElementById('hero-category-link')?.value        || '',
  };
  try {
    await API.settings.update(data);
    showToast('Hero banner saved', 'success');
  } catch (e) {
    showToast(e.message || 'Failed to save banner', 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   SECTION: REPAIR SERVICES
   Full CRUD list — cards on the public Repair page, plus
   the appliance_type feeds that page's booking dropdown.
   ══════════════════════════════════════════════════════════ */
async function loadRepairServicesTab() {
  const list = document.getElementById('repair-services-list');
  try {
    _repairServices = await API.repairServices.getAll();
    renderRepairServicesList();
    bindOnce('add-repair-service-btn', () => openRepairServiceModal());
  } catch (e) {
    console.error('Repair services load error:', e);
    list.innerHTML = emptyState('⚠️', 'Could not load services.');
  }
}

function renderRepairServicesList() {
  const list = document.getElementById('repair-services-list');
  if (!_repairServices.length) {
    list.innerHTML = emptyState('🔧', 'No services yet. Click "+ Add Service" to create one.');
    return;
  }
  list.innerHTML = _repairServices.map(s => `
    <div class="content-list-row">
      <div class="content-row-icon">${s.icon || '🔧'}</div>
      <div class="content-row-text">
        <div class="content-row-title">${escapeHtml(s.name)}</div>
        <div class="content-row-sub">${escapeHtml(s.description || '')} · Appliance: ${escapeHtml(s.appliance_type)}</div>
      </div>
      <div class="content-row-actions">
        <button class="icon-btn" onclick="openRepairServiceModal(${s.id})" title="Edit">✏️</button>
        <button class="icon-btn danger" onclick="deleteRepairService(${s.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openRepairServiceModal(id = null) {
  const modal = document.getElementById('repair-service-modal');
  const title = document.getElementById('repair-service-modal-title');
  const form  = document.getElementById('repair-service-form');
  form.reset();
  document.getElementById('rs-modal-id').value = '';

  if (id) {
    const svc = _repairServices.find(s => s.id === id);
    if (svc) {
      title.textContent = 'Edit Service';
      document.getElementById('rs-modal-id').value          = svc.id;
      document.getElementById('rs-modal-icon').value         = svc.icon || '';
      document.getElementById('rs-modal-name').value         = svc.name;
      document.getElementById('rs-modal-description').value  = svc.description || '';
      document.getElementById('rs-modal-appliance').value    = svc.appliance_type;
    }
  } else {
    title.textContent = 'Add Service';
  }
  modal.classList.add('active');
}

function closeRepairServiceModal() {
  document.getElementById('repair-service-modal').classList.remove('active');
}

async function deleteRepairService(id) {
  if (!confirm('Delete this repair service? This cannot be undone.')) return;
  try {
    await API.repairServices.remove(id);
    showToast('Service deleted', 'success');
    loadRepairServicesTab();
  } catch (e) {
    showToast(e.message || 'Failed to delete', 'error');
  }
}

function bindRepairServiceForm() {
  const form = document.getElementById('repair-service-form');
  if (form.dataset.bound) return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rs-modal-id').value;
    const data = {
      icon:           document.getElementById('rs-modal-icon').value.trim()        || '🔧',
      name:           document.getElementById('rs-modal-name').value.trim(),
      description:    document.getElementById('rs-modal-description').value.trim(),
      appliance_type: document.getElementById('rs-modal-appliance').value.trim(),
    };
    try {
      if (id) {
        await API.repairServices.update(id, data);
        showToast('Service updated', 'success');
      } else {
        await API.repairServices.add(data);
        showToast('Service added', 'success');
      }
      closeRepairServiceModal();
      loadRepairServicesTab();
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    }
  });
}

/* ══════════════════════════════════════════════════════════
   SECTION: DELIVERY INFO
   Full CRUD list — cards on the public Contact page's
   "Home Delivery Service" section.
   ══════════════════════════════════════════════════════════ */
async function loadDeliveryCardsTab() {
  const list = document.getElementById('delivery-cards-list');
  try {
    _deliveryCards = await API.deliveryCards.getAll();
    renderDeliveryCardsList();
    bindOnce('add-delivery-card-btn', () => openDeliveryCardModal());
  } catch (e) {
    console.error('Delivery cards load error:', e);
    list.innerHTML = emptyState('⚠️', 'Could not load delivery cards.');
  }
}

function renderDeliveryCardsList() {
  const list = document.getElementById('delivery-cards-list');
  if (!_deliveryCards.length) {
    list.innerHTML = emptyState('🚚', 'No delivery cards yet. Click "+ Add Card" to create one.');
    return;
  }
  list.innerHTML = _deliveryCards.map(c => `
    <div class="content-list-row">
      <div class="content-row-icon">${c.icon || '🚚'}</div>
      <div class="content-row-text">
        <div class="content-row-title">${escapeHtml(c.title)}</div>
        <div class="content-row-sub">${escapeHtml(c.description || '')}</div>
      </div>
      <div class="content-row-actions">
        <button class="icon-btn" onclick="openDeliveryCardModal(${c.id})" title="Edit">✏️</button>
        <button class="icon-btn danger" onclick="deleteDeliveryCard(${c.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openDeliveryCardModal(id = null) {
  const modal = document.getElementById('delivery-card-modal');
  const title = document.getElementById('delivery-card-modal-title');
  const form  = document.getElementById('delivery-card-form');
  form.reset();
  document.getElementById('dc-modal-id').value = '';

  if (id) {
    const card = _deliveryCards.find(c => c.id === id);
    if (card) {
      title.textContent = 'Edit Delivery Card';
      document.getElementById('dc-modal-id').value          = card.id;
      document.getElementById('dc-modal-icon').value         = card.icon || '';
      document.getElementById('dc-modal-title').value        = card.title;
      document.getElementById('dc-modal-description').value  = card.description || '';
    }
  } else {
    title.textContent = 'Add Delivery Card';
  }
  modal.classList.add('active');
}

function closeDeliveryCardModal() {
  document.getElementById('delivery-card-modal').classList.remove('active');
}

async function deleteDeliveryCard(id) {
  if (!confirm('Delete this delivery card? This cannot be undone.')) return;
  try {
    await API.deliveryCards.remove(id);
    showToast('Card deleted', 'success');
    loadDeliveryCardsTab();
  } catch (e) {
    showToast(e.message || 'Failed to delete', 'error');
  }
}

function bindDeliveryCardForm() {
  const form = document.getElementById('delivery-card-form');
  if (form.dataset.bound) return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('dc-modal-id').value;
    const data = {
      icon:        document.getElementById('dc-modal-icon').value.trim()        || '🚚',
      title:       document.getElementById('dc-modal-title').value.trim(),
      description: document.getElementById('dc-modal-description').value.trim(),
    };
    try {
      if (id) {
        await API.deliveryCards.update(id, data);
        showToast('Card updated', 'success');
      } else {
        await API.deliveryCards.add(data);
        showToast('Card added', 'success');
      }
      closeDeliveryCardModal();
      loadDeliveryCardsTab();
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    }
  });
}

/* ══════════════════════════════════════════════════════════
   SECTION: TRUST STRIP
   Full CRUD list — the 4-box trust indicators on the public
   Home and About pages.
   ══════════════════════════════════════════════════════════ */
async function loadTrustItemsTab() {
  const list = document.getElementById('trust-items-list');
  try {
    _trustItems = await API.trustItems.getAll();
    renderTrustItemsList();
    bindOnce('add-trust-item-btn', () => openTrustItemModal());
  } catch (e) {
    console.error('Trust items load error:', e);
    list.innerHTML = emptyState('⚠️', 'Could not load trust items.');
  }
}

function renderTrustItemsList() {
  const list = document.getElementById('trust-items-list');
  if (!_trustItems.length) {
    list.innerHTML = emptyState('🏆', 'No trust items yet. Click "+ Add Item" to create one.');
    return;
  }
  list.innerHTML = _trustItems.map(t => `
    <div class="content-list-row">
      <div class="content-row-icon">${t.icon || '🛡️'}</div>
      <div class="content-row-text">
        <div class="content-row-title">${escapeHtml(t.title)}</div>
        <div class="content-row-sub">${escapeHtml(t.subtitle || '')}</div>
      </div>
      <div class="content-row-actions">
        <button class="icon-btn" onclick="openTrustItemModal(${t.id})" title="Edit">✏️</button>
        <button class="icon-btn danger" onclick="deleteTrustItem(${t.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function openTrustItemModal(id = null) {
  const modal = document.getElementById('trust-item-modal');
  const title = document.getElementById('trust-item-modal-title');
  const form  = document.getElementById('trust-item-form');
  form.reset();
  document.getElementById('ti-modal-id').value = '';

  if (id) {
    const item = _trustItems.find(t => t.id === id);
    if (item) {
      title.textContent = 'Edit Trust Item';
      document.getElementById('ti-modal-id').value       = item.id;
      document.getElementById('ti-modal-icon').value      = item.icon || '';
      document.getElementById('ti-modal-title').value     = item.title;
      document.getElementById('ti-modal-subtitle').value  = item.subtitle || '';
    }
  } else {
    title.textContent = 'Add Trust Item';
  }
  modal.classList.add('active');
}

function closeTrustItemModal() {
  document.getElementById('trust-item-modal').classList.remove('active');
}

async function deleteTrustItem(id) {
  if (!confirm('Delete this trust item? This cannot be undone.')) return;
  try {
    await API.trustItems.remove(id);
    showToast('Item deleted', 'success');
    loadTrustItemsTab();
  } catch (e) {
    showToast(e.message || 'Failed to delete', 'error');
  }
}

function bindTrustItemForm() {
  const form = document.getElementById('trust-item-form');
  if (form.dataset.bound) return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ti-modal-id').value;
    const data = {
      icon:    document.getElementById('ti-modal-icon').value.trim()    || '🛡️',
      title:   document.getElementById('ti-modal-title').value.trim(),
      subtitle:document.getElementById('ti-modal-subtitle').value.trim(),
    };
    try {
      if (id) {
        await API.trustItems.update(id, data);
        showToast('Item updated', 'success');
      } else {
        await API.trustItems.add(data);
        showToast('Item added', 'success');
      }
      closeTrustItemModal();
      loadTrustItemsTab();
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    }
  });
}

/* ══════════════════════════════════════════════════════════
   SECTION: SHARED HELPERS
   ══════════════════════════════════════════════════════════ */

/** Set an input's value only if a value is provided (keeps placeholder otherwise) */
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

/** Bind a click handler exactly once, even if this loader runs multiple times
    (e.g. revisiting a tab) — prevents duplicate event listeners stacking up. */
function bindOnce(elId, handler) {
  const el = document.getElementById(elId);
  if (!el || el.dataset.bound) return;
  el.dataset.bound = 'true';
  el.addEventListener('click', handler);
}

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><div class="empty-state-text">${text}</div></div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* Bind all three modal forms once, on initial script load
   (the modals exist in the DOM from page load, unlike the
   list content which loads lazily per-tab). */
document.addEventListener('DOMContentLoaded', () => {
  bindRepairServiceForm();
  bindDeliveryCardForm();
  bindTrustItemForm();
});
