/* ============================================================
   dashboard-api.js — Dashboard Logic (API-powered)
   Page: pages/dashboard.html
   Depends on: api.js (loaded before this file)
   
   All data comes from Flask backend via API object.
   No localStorage used here.
   ============================================================ */

'use strict';

/* ── Currency format helper */
const fmt = (n) => '₹' + parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];

/* ── All inventory (cached for dropdowns) */
let _inventory  = [];
let _settings   = {};
let _revenueChart = null;
let _catChart     = null;

/* ══════════════════════════════════════════════════════════
   SECTION: INIT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  /* ── Auth guard — redirect to login if no token */
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  Shell.init();
  loadOverview();
  loadInventory();
  loadSales();
  loadSettings();
});

/* ══════════════════════════════════════════════════════════
   SECTION: SHELL — topbar, sidebar, tabs
   ══════════════════════════════════════════════════════════ */
const Shell = {
  init() {
    this.setDate();
    this.bindTabs();
    this.bindSidebar();
    this.bindStoreToggle();
  },

  setDate() {
    const el = document.getElementById('topbar-date');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-IN', {
      weekday:'short', day:'numeric', month:'short', year:'numeric'
    });
  },

  /* ── COMPONENT: Tab Switching */
  bindTabs() {
    document.querySelectorAll('.tab-btn, .sidebar-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!tab) return;
        switchTab(tab);
        document.getElementById('sidebar')?.classList.remove('open');
      });
    });
  },

  /* ── COMPONENT: Mobile Sidebar */
  bindSidebar() {
    const toggle  = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    toggle?.addEventListener('click', () => sidebar?.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!sidebar?.contains(e.target) && !toggle?.contains(e.target)) {
        sidebar?.classList.remove('open');
      }
    });
  },

  /* ── COMPONENT: Store Open/Closed Toggle */
  bindStoreToggle() {
    const toggle = document.getElementById('store-toggle');
    if (!toggle) return;
    toggle.addEventListener('change', async () => {
      try {
        await API.settings.update({ store_open: toggle.checked ? 'true' : 'false' });
        const dot   = document.getElementById('store-dot');
        const label = document.getElementById('store-label');
        if (dot)   dot.className   = 'status-dot ' + (toggle.checked ? 'open' : 'closed');
        if (label) label.textContent = toggle.checked ? 'Store is Open' : 'Store is Closed';
        showToast(toggle.checked ? 'Store marked Open' : 'Store marked Closed',
          toggle.checked ? 'success' : 'info');
      } catch(e) {
        showToast(e.message, 'error');
      }
    });
  },
};

/* Tab switcher — called globally from HTML onclick */
function switchTab(tab) {
  const TITLES = { overview:'Overview', inventory:'Inventory', sales:'Sales', settings:'Settings' };

  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.sidebar-item[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'tab-' + tab));

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = TITLES[tab] || tab;

  if (tab === 'overview') loadOverview();
}

/* Logout */
function handleLogout() {
  Auth.logout();
  window.location.href = 'login.html';
}

/* ══════════════════════════════════════════════════════════
   SECTION: OVERVIEW
   ══════════════════════════════════════════════════════════ */
async function loadOverview() {
  try {
    const summary = await API.sales.summary(today());
    renderKPIs(summary);
    renderCharts(summary);
    renderRecentSales();
    renderLowStockBanner(summary.inventory);

    /* Shop name */
    const nameEl = document.getElementById('overview-shop-name');
    if (nameEl && _settings.shop_name) nameEl.textContent = _settings.shop_name;
  } catch(e) {
    console.error('Overview error:', e);
  }
}

/* ── COMPONENT: KPI Cards */
function renderKPIs(summary) {
  const d = summary.daily;
  const y = summary.yesterday;
  const inv = summary.inventory;

  setKPI('kpi-revenue', fmt(d.revenue), pct(d.revenue, y.revenue));
  setKPI('kpi-profit',  fmt(d.profit),  pct(d.profit,  y.profit));
  setKPI('kpi-orders',  d.orders,       pct(d.orders,  y.orders));

  setText('kpi-inventory', (inv?.total_products || 0) + ' items');
  setText('kpi-low-stock', `${inv?.low_stock_count || 0} low stock items`);

  /* Low stock badge on sidebar */
  const badge = document.getElementById('low-stock-badge');
  if (badge) {
    const count = parseInt(inv?.low_stock_count || 0);
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}

function setKPI(id, value, change) {
  setText(id, value);
  const el = document.getElementById(id + '-change');
  if (!el) return;
  if (change > 0)      { el.className = 'kpi-change up';   el.innerHTML = `▲ ${change}% vs yesterday`; }
  else if (change < 0) { el.className = 'kpi-change down'; el.innerHTML = `▼ ${Math.abs(change)}% vs yesterday`; }
  else                 { el.className = 'kpi-change flat'; el.innerHTML = `— same as yesterday`; }
}

function pct(curr, prev) {
  curr = parseFloat(curr); prev = parseFloat(prev);
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

/* ── COMPONENT: Charts */
function renderCharts(summary) {
  if (typeof Chart === 'undefined') return;

  /* Revenue / Profit bar */
  const rCtx = document.getElementById('revenue-chart');
  if (rCtx) {
    if (_revenueChart) _revenueChart.destroy();
    const weekly = summary.weekly || [];
    _revenueChart = new Chart(rCtx, {
      type: 'bar',
      data: {
        labels: weekly.map(d => d.label),
        datasets: [
          { label:'Revenue', data: weekly.map(d => d.revenue),
            backgroundColor:'rgba(201,168,76,0.8)', borderRadius:6, borderSkipped:false },
          { label:'Profit',  data: weekly.map(d => d.profit),
            backgroundColor:'rgba(76,175,125,0.7)', borderRadius:6, borderSkipped:false },
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: c=>' '+fmt(c.raw) } } },
        scales:{
          x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#666',font:{size:11}} },
          y:{ grid:{color:'rgba(255,255,255,0.04)'},
              ticks:{ color:'#666', font:{size:11}, callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v) },
              border:{display:false} }
        }
      }
    });
  }

  /* Category doughnut */
  const cCtx = document.getElementById('category-chart');
  if (cCtx) {
    if (_catChart) _catChart.destroy();
    const cats = (summary.category_sales || []).filter(c => c.category);
    const COLORS = ['#c9a84c','#4caf7d','#4a9edd','#e09a3a','#e05555','#9b59b6','#1abc9c'];
    _catChart = new Chart(cCtx, {
      type:'doughnut',
      data:{
        labels: cats.map(c=>c.category),
        datasets:[{ data:cats.map(c=>parseFloat(c.revenue)),
          backgroundColor:COLORS.slice(0,cats.length), borderWidth:2, borderColor:'#111' }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, cutout:'65%',
        plugins:{
          legend:{ position:'bottom', labels:{color:'#888',font:{size:11},padding:12,boxWidth:10,boxHeight:10} },
          tooltip:{ callbacks:{ label:c=>' '+fmt(c.raw) } }
        }
      }
    });
  }
}

/* ── COMPONENT: Recent Sales */
async function renderRecentSales() {
  const list = document.getElementById('recent-sales-list');
  if (!list) return;
  try {
    const sales = await API.sales.getRecent();
    const recent = sales.slice(0,5);
    if (!recent.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No sales recorded yet</div></div>`;
      return;
    }
    const MI = { Cash:'💵', UPI:'📲', Card:'💳' };
    list.innerHTML = recent.map(s => `
      <div class="activity-item">
        <div class="activity-icon" style="background:rgba(201,168,76,0.1)">${MI[s.payment_mode]||'💰'}</div>
        <div class="activity-info">
          <div class="activity-title">${s.product_name}</div>
          <div class="activity-time">${s.customer_name} · ${s.sale_date} · ${s.payment_mode}</div>
        </div>
        <div class="activity-amount text-gold">${fmt(s.total)}</div>
      </div>
    `).join('');
  } catch(e) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${e.message}</div></div>`;
  }
}

/* ── COMPONENT: Low Stock Banner */
function renderLowStockBanner(inv) {
  const banner = document.getElementById('low-stock-banner');
  if (!banner) return;
  const count = parseInt(inv?.low_stock_count || 0);
  banner.style.display = count > 0 ? 'flex' : 'none';
  if (count > 0) {
    const textEl = document.getElementById('low-stock-text');
    if (textEl) textEl.textContent = `⚠️  ${count} product(s) are running low on stock`;
  }
}

/* ══════════════════════════════════════════════════════════
   SECTION: INVENTORY
   ══════════════════════════════════════════════════════════ */
let _invFilter = 'All';
let _invSearch = '';
let _invPage   = 1;
const INV_PER_PAGE = 10;

async function loadInventory() {
  try {
    _inventory = await API.inventory.getAll();
    renderCategoryFilters();
    renderInventoryTable();
    populateSaleProductDropdown();
  } catch(e) {
    showToast('Failed to load inventory: ' + e.message, 'error');
  }
}

/* ── COMPONENT: Category Filters */
function renderCategoryFilters() {
  const bar = document.getElementById('category-filters');
  if (!bar) return;
  const cats = ['All', ...new Set(_inventory.map(p => p.category))];
  bar.innerHTML = cats.map(c =>
    `<button class="filter-tab ${c===_invFilter?'active':''}" data-cat="${c}">${c}</button>`
  ).join('');
  bar.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      _invFilter = btn.dataset.cat;
      _invPage = 1;
      renderInventoryTable();
    });
  });
}

/* ── COMPONENT: Inventory Table */
function renderInventoryTable() {
  const tbody   = document.getElementById('inventory-tbody');
  const countEl = document.getElementById('inventory-count');
  if (!tbody) return;

  let items = [..._inventory];
  if (_invFilter !== 'All') items = items.filter(p => p.category === _invFilter);
  if (_invSearch) {
    const q = _invSearch.toLowerCase();
    items = items.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)  ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (countEl) countEl.textContent = `${items.length} products`;

  const start = (_invPage-1)*INV_PER_PAGE;
  const paged = items.slice(start, start+INV_PER_PAGE);

  if (!paged.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No products found</div></div></td></tr>`;
  } else {
    tbody.innerHTML = paged.map(p => {
      const stockPct   = Math.min((p.stock_qty/30)*100, 100);
      const stockClass = p.stock_qty<=3?'low':p.stock_qty<=8?'medium':'high';
      const stockColor = p.stock_qty<=3?'var(--color-danger)':p.stock_qty<=8?'var(--color-warning)':'var(--color-success)';
      return `
        <tr>
          <td>
            <div class="product-cell">
              <div class="product-thumb">${p.emoji||'📦'}</div>
              <div>
                <div class="product-name">${p.name}</div>
                <div class="product-sku">${p.sku}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-info">${p.category}</span></td>
          <td class="text-gold" style="font-weight:600">${fmt(p.price)}</td>
          <td style="color:var(--color-text-secondary)">${fmt(p.cost)}</td>
          <td>
            <div class="stock-bar-wrap">
              <div class="stock-bar-track">
                <div class="stock-bar-fill ${stockClass}" style="width:${stockPct}%"></div>
              </div>
              <span class="stock-number" style="color:${stockColor}">${p.stock_qty}</span>
            </div>
          </td>
          <td>${p.stock_qty<=3
            ?'<span class="badge badge-danger">Low</span>'
            :p.stock_qty<=8
            ?'<span class="badge badge-warning">Medium</span>'
            :'<span class="badge badge-success">Good</span>'
          }</td>
          <td>
            <div class="table-actions">
              <button class="icon-btn edit" onclick="openEditProduct(${p.id})" title="Edit">✏️</button>
              <button class="icon-btn del"  onclick="deleteProduct(${p.id})" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* Pagination */
  const pgEl   = document.getElementById('inventory-pagination');
  const infoEl = document.getElementById('inventory-page-info');
  const total  = items.length;
  const pages  = Math.ceil(total/INV_PER_PAGE);
  const s = (_invPage-1)*INV_PER_PAGE+1;
  const e = Math.min(_invPage*INV_PER_PAGE, total);
  if (infoEl) infoEl.textContent = `Showing ${total>0?s:0}–${e} of ${total}`;
  if (pgEl) {
    let btns = '';
    for(let i=1;i<=pages;i++) btns+=`<button class="page-btn ${i===_invPage?'active':''}" onclick="invGoPage(${i})">${i}</button>`;
    pgEl.innerHTML = btns;
  }
}

function invGoPage(n) { _invPage=n; renderInventoryTable(); }

/* Search */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inventory-search')?.addEventListener('input', (e) => {
    _invSearch = e.target.value.trim();
    _invPage = 1;
    renderInventoryTable();
  });
});

/* ── COMPONENT: Add Product Modal */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('add-product-btn')?.addEventListener('click', () => {
    document.getElementById('product-form').reset();
    document.getElementById('modal-product-id').value = '';
    document.getElementById('modal-title').textContent = 'Add Product';
    document.getElementById('add-product-modal').classList.add('active');
  });

  document.getElementById('product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pid = document.getElementById('modal-product-id').value;
    const product = {
      name      : document.getElementById('modal-name').value.trim(),
      sku       : document.getElementById('modal-sku').value.trim(),
      category  : document.getElementById('modal-category').value,
      price     : parseFloat(document.getElementById('modal-price').value),
      cost      : parseFloat(document.getElementById('modal-cost').value),
      stock_qty : parseInt(document.getElementById('modal-stock').value),
      emoji     : document.getElementById('modal-emoji').value || '📦',
    };
    try {
      if (pid) {
        await API.inventory.update(pid, product);
        showToast('Product updated', 'success');
      } else {
        await API.inventory.add(product);
        showToast('Product added', 'success');
      }
      closeModal();
      await loadInventory();
      loadOverview();
    } catch(err) {
      showToast(err.message, 'error');
    }
  });
});

function openEditProduct(id) {
  const p = _inventory.find(x=>x.id===id);
  if (!p) return;
  document.getElementById('modal-product-id').value = id;
  document.getElementById('modal-name').value     = p.name;
  document.getElementById('modal-sku').value      = p.sku;
  document.getElementById('modal-category').value = p.category;
  document.getElementById('modal-price').value    = p.price;
  document.getElementById('modal-cost').value     = p.cost;
  document.getElementById('modal-stock').value    = p.stock_qty;
  document.getElementById('modal-emoji').value    = p.emoji || '';
  document.getElementById('modal-title').textContent = 'Edit Product';
  document.getElementById('add-product-modal').classList.add('active');
}

async function deleteProduct(id) {
  const p = _inventory.find(x=>x.id===id);
  if (!p || !confirm(`Delete "${p.name}"?`)) return;
  try {
    await API.inventory.remove(id);
    showToast('Product deleted', 'info');
    await loadInventory();
    loadOverview();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

function closeModal() {
  document.getElementById('add-product-modal').classList.remove('active');
}

/* ══════════════════════════════════════════════════════════
   SECTION: SALES
   ══════════════════════════════════════════════════════════ */
let _salesDate = today();

function loadSales() {
  const dateInput = document.getElementById('sales-date-filter');
  if (dateInput) {
    dateInput.value = _salesDate;
    dateInput.addEventListener('change', () => {
      _salesDate = dateInput.value;
      refreshSales();
    });
  }

  /* Populate product dropdown */
  populateSaleProductDropdown();

  /* Price auto-fill */
  document.getElementById('sale-product')?.addEventListener('change', () => {
    const sel = document.getElementById('sale-product');
    const p = _inventory.find(x=>x.id==sel.value);
    if (p) { document.getElementById('sale-price').value = p.price; updateSaleTotal(); }
  });

  [document.getElementById('sale-qty'), document.getElementById('sale-price')].forEach(el =>
    el?.addEventListener('input', updateSaleTotal)
  );

  const dateEl = document.getElementById('sale-date');
  if (dateEl) dateEl.value = today();

  document.getElementById('sale-form')?.addEventListener('submit', submitSale);

  refreshSales();
}

function populateSaleProductDropdown() {
  const sel = document.getElementById('sale-product');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select Product —</option>' +
    _inventory.map(p =>
      `<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost}">${p.emoji||''} ${p.name}</option>`
    ).join('');
}

function updateSaleTotal() {
  const qty   = parseFloat(document.getElementById('sale-qty')?.value) || 0;
  const price = parseFloat(document.getElementById('sale-price')?.value) || 0;
  const el    = document.getElementById('sale-total-preview');
  if (el) el.textContent = fmt(qty*price);
}

async function refreshSales() {
  /* Summary */
  try {
    const summary = await API.sales.summary(_salesDate);
    const d = summary.daily;
    setText('sales-day-revenue', fmt(d.revenue));
    setText('sales-day-profit',  fmt(d.profit));
    setText('sales-day-orders',  d.orders);
  } catch(e) {}

  /* Table */
  const tbody   = document.getElementById('sales-tbody');
  const countEl = document.getElementById('sales-count');
  if (!tbody) return;
  try {
    const sales = await API.sales.getByDate(_salesDate);
    if (countEl) countEl.textContent = `${sales.length} transactions`;
    if (!sales.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No sales for this date</div></div></td></tr>`;
      return;
    }
    const MI = { Cash:'💵', UPI:'📲', Card:'💳' };
    tbody.innerHTML = sales.map(s => `
      <tr>
        <td>
          <div class="product-name">${s.product_name}</div>
          <div class="product-sku">${s.customer_name}</div>
        </td>
        <td style="color:var(--color-text-secondary)">${s.qty}</td>
        <td style="color:var(--color-text-secondary)">${fmt(s.unit_price)}</td>
        <td class="text-gold" style="font-weight:600">${fmt(s.total)}</td>
        <td class="text-success">${fmt(s.profit)}</td>
        <td><span class="badge badge-info">${MI[s.payment_mode]||''} ${s.payment_mode}</span></td>
        <td><button class="icon-btn del" onclick="deleteSale(${s.id})" title="Delete">🗑️</button></td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${e.message}</div></div></td></tr>`;
  }
}

async function submitSale(e) {
  e.preventDefault();
  const sel  = document.getElementById('sale-product');
  const p    = _inventory.find(x=>x.id==sel.value);
  if (!p) { showToast('Select a product', 'error'); return; }

  const qty   = parseInt(document.getElementById('sale-qty').value);
  const price = parseFloat(document.getElementById('sale-price').value);
  const cost  = parseFloat(p.cost);

  const sale = {
    product_id    : p.id,
    product_name  : p.name,
    qty,
    unit_price    : price,
    total         : qty*price,
    profit        : qty*(price-cost),
    sale_date     : document.getElementById('sale-date').value || today(),
    payment_mode  : document.getElementById('sale-payment').value || 'Cash',
    customer_name : document.getElementById('sale-customer').value?.trim() || 'Walk-in',
  };

  try {
    await API.sales.add(sale);
    document.getElementById('sale-form').reset();
    document.getElementById('sale-date').value = today();
    document.getElementById('sale-total-preview').textContent = '₹0';
    showToast(`Sale recorded — ${fmt(sale.total)}`, 'success');
    await loadInventory();   /* refresh stock */
    refreshSales();
    loadOverview();
  } catch(err) {
    showToast(err.message, 'error');
  }
}

async function deleteSale(id) {
  if (!confirm('Delete this sale record?')) return;
  try {
    await API.sales.remove(id);
    showToast('Sale deleted', 'info');
    refreshSales();
    loadOverview();
  } catch(e) {
    showToast(e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   SECTION: SETTINGS
   ══════════════════════════════════════════════════════════ */
async function loadSettings() {
  try {
    const [settings, owner] = await Promise.all([
      API.settings.getAll(),
      API.public.owner(),
    ]);
    _settings = settings;

    /* Populate shop form */
    const shopMap = {
      'set-shopname'  : settings.shop_name,
      'set-tagline'   : settings.tagline,
      'set-address'   : settings.address,
      'set-phone'     : settings.phone,
      'set-whatsapp'  : settings.whatsapp,
      'set-email'     : settings.email,
      'set-gst'       : settings.gst,
      'set-low-stock' : settings.low_stock_alert,
    };
    Object.entries(shopMap).forEach(([id,val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });

    /* Populate owner form */
    const ownerMap = {
      'set-owner-name'     : owner.name,
      'set-owner-role'     : owner.role,
      'set-owner-phone'    : owner.phone,
      'set-owner-email'    : owner.email,
      'set-owner-initials' : owner.initials,
      'set-owner-bio'      : owner.bio,
    };
    Object.entries(ownerMap).forEach(([id,val]) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    });

    /* Store toggle */
    const toggle = document.getElementById('store-toggle');
    if (toggle) toggle.checked = settings.store_open === 'true';
    const dot = document.getElementById('store-dot');
    if (dot) dot.className = 'status-dot ' + (settings.store_open==='true'?'open':'closed');

    /* Shop name in sidebar */
    setText('sb-shop-name', settings.shop_name);

    /* Bind save buttons */
    document.getElementById('save-shop-btn')?.addEventListener('click', saveShopSettings);
    document.getElementById('save-owner-btn')?.addEventListener('click', saveOwnerSettings);
    document.getElementById('change-pass-btn')?.addEventListener('click', changePassword);

  } catch(e) {
    console.error('Settings load error:', e);
  }
}

async function saveShopSettings() {
  const data = {
    shop_name       : document.getElementById('set-shopname')?.value  || '',
    tagline         : document.getElementById('set-tagline')?.value   || '',
    address         : document.getElementById('set-address')?.value   || '',
    phone           : document.getElementById('set-phone')?.value     || '',
    whatsapp        : document.getElementById('set-whatsapp')?.value  || '',
    email           : document.getElementById('set-email')?.value     || '',
    gst             : document.getElementById('set-gst')?.value       || '',
    low_stock_alert : document.getElementById('set-low-stock')?.value || '5',
  };
  try {
    await API.settings.update(data);
    _settings = { ..._settings, ...data };
    setText('sb-shop-name', data.shop_name);
    showToast('Shop settings saved', 'success');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function saveOwnerSettings() {
  const data = {
    name     : document.getElementById('set-owner-name')?.value     || '',
    role     : document.getElementById('set-owner-role')?.value     || '',
    phone    : document.getElementById('set-owner-phone')?.value    || '',
    email    : document.getElementById('set-owner-email')?.value    || '',
    initials : document.getElementById('set-owner-initials')?.value || '',
    bio      : document.getElementById('set-owner-bio')?.value      || '',
  };
  try {
    await API.owner.update(data);
    showToast('Profile saved', 'success');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

async function changePassword() {
  const curr = document.getElementById('set-curr-pass')?.value || '';
  const next = document.getElementById('set-new-pass')?.value  || '';
  if (!curr || !next) { showToast('Fill both password fields', 'error'); return; }
  try {
    await API.auth.changePassword(curr, next);
    document.getElementById('set-curr-pass').value = '';
    document.getElementById('set-new-pass').value  = '';
    showToast('Password changed successfully', 'success');
  } catch(e) {
    showToast(e.message, 'error');
  }
}

/* ══════════════════════════════════════════════════════════
   SECTION: TOAST & UTILITIES
   ══════════════════════════════════════════════════════════ */
function showToast(msg, type='info', duration=3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.textContent = val;
}
