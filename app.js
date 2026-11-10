function cleanSearchText(str) {
  if (!str) return '';
  return str.toString()
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’\-]/g, ' ')
    .trim();
}
// Logique de l'application Gamelle & Panier

// Icônes vectorielles (nettes sur iPhone, suivent la couleur du texte en mode clair comme sombre)
const ICONS = {
  lock: '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
  unlock: '<svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 7.75-1.4"/></svg>',
  heart: (filled, size = 'w-[18px] h-[18px]') => `<svg class="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.5 3.4 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>`
};
// ==========================================
// OUTILS COMMUNS : sécurité, stockage, notifications, boîtes de dialogue
// ==========================================

// Échappe tout texte inséré dans du HTML (titres de recettes, noms, etc.)
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Visuel affiché quand une photo est absente ou indisponible hors ligne (même motif que le logo)
const IMG_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>" +
  "<g fill='#10b981' fill-opacity='.32'>" +
  "<path d='M64 100C64 48 136 48 136 100' fill='none' stroke='#10b981' stroke-opacity='.32' stroke-width='9' stroke-linecap='round'/>" +
  "<rect x='46' y='100' width='108' height='10' rx='5'/>" +
  "<path d='M54 118H146C146 146 124 164 100 164C76 164 54 146 54 118Z'/></g></svg>"
);

function safeImg(url) {
  const u = String(url || '').trim();
  return /^https?:\/\//i.test(u) ? u : IMG_PLACEHOLDER;
}

function imgFallback(img) {
  img.onerror = null;
  img.src = IMG_PLACEHOLDER;
}
window.imgFallback = imgFallback;

// Accès au stockage local sans jamais planter (mode privé, quota plein, données corrompues)
function safeGetItem(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function safeSetItem(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function safeRemoveItem(key) { try { localStorage.removeItem(key); } catch (e) {} }
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

// --- Validation des données (stockage local, lien de partage, synchro foyer) ---
function cleanStr(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanNum(v, min, max, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function sanitizeStringList(list, maxItems = 600, maxLen = 120) {
  return Array.isArray(list)
    ? list.filter(x => typeof x === 'string').map(x => cleanStr(x, maxLen)).filter(Boolean).slice(0, maxItems)
    : [];
}
function sanitizePlan(plan) {
  return Array.isArray(plan)
    ? plan.slice(0, 60).map(id => (typeof id === 'string' && id.trim() ? cleanStr(id, 80) : null))
    : [];
}
function sanitizeSlots(slots) {
  return Array.isArray(slots)
    ? [...new Set(slots.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < 60))]
    : [];
}
function sanitizeStaples(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 200).map((s, i) => {
    if (typeof s === 'string') s = { name: s };
    if (!s || typeof s !== 'object') return null;
    const name = cleanStr(s.name, 80);
    if (!name) return null;
    return { id: cleanStr(s.id, 60) || ('staple_' + Date.now() + '_' + i), name, checked: s.checked === true };
  }).filter(Boolean);
}
function sanitizeChecked(map) {
  const out = {};
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    Object.keys(map).slice(0, 800).forEach(k => { if (map[k] === true) out[cleanStr(k, 200)] = true; });
  }
  return out;
}
function sanitizeSavedMenus(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 30).map(m => {
    if (!m || typeof m !== 'object') return null;
    const planSrc = Array.isArray(m.plan) ? m.plan : (m.plan && typeof m.plan === 'object' ? Object.values(m.plan) : []);
    return {
      id: cleanStr(m.id, 60) || ('menu_' + Date.now()),
      name: cleanStr(m.name, 80) || 'Menu',
      date: cleanStr(m.date, 40),
      portions: Math.round(cleanNum(m.portions, 1, 12, 4)),
      plan: sanitizePlan(planSrc),
      staples: sanitizeStaples(m.staples)
    };
  }).filter(Boolean);
}
const KNOWN_RECIPE_TYPES = ['volaille', 'poisson', 'vege', 'vegetarien', 'viande'];
function sanitizeCustomRecipe(r) {
  if (!r || typeof r !== 'object') return null;
  const id = cleanStr(r.id, 80);
  if (!/^custom-[\w-]+$/.test(id)) return null;
  const title = cleanStr(r.title, 140);
  if (!title) return null;
  const rayons = new Set((window.GRAND_FRAIS_RAYONS || []).map(x => x.id));
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).slice(0, 80).map(i => {
    if (!i || typeof i !== 'object') return null;
    const name = cleanStr(i.name, 100);
    if (!name) return null;
    return {
      name,
      quantity: cleanNum(i.quantity, 0, 100000, 1),
      unit: cleanStr(i.unit, 30).replace(/[<>"'&`]/g, ''),
      rayon: rayons.has(i.rayon) ? i.rayon : 'epicerie'
    };
  }).filter(Boolean);
  const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, 60).map(s => {
    if (typeof s === 'string') s = { instruction: s };
    if (!s || typeof s !== 'object') return null;
    const instruction = cleanStr(s.instruction, 1500);
    if (!instruction) return null;
    const t = Number(s.timerMinutes);
    return {
      instruction,
      ingredients: sanitizeStringList(s.ingredients, 30, 100),
      timerMinutes: Number.isFinite(t) && t > 0 ? Math.min(600, Math.round(t)) : null
    };
  }).filter(Boolean);
  return {
    id,
    title,
    description: cleanStr(r.description || 'Recette maison personnalisée', 300),
    season: ['automne', 'hiver', 'toutes'].includes(r.season) ? r.season : 'toutes',
    timeMinutes: Math.round(cleanNum(r.timeMinutes, 1, 600, 25)),
    tag: cleanStr(r.tag || 'Recette Maison', 60),
    type: KNOWN_RECIPE_TYPES.includes(r.type) ? r.type : 'volaille',
    isBudget: r.isBudget === true,
    basePortions: Math.round(cleanNum(r.basePortions, 1, 24, 4)),
    image: /^https?:\/\//i.test(String(r.image || '').trim()) ? String(r.image).trim().slice(0, 600) : '',
    ingredients,
    steps
  };
}
function sanitizeRecipeList(list) {
  return Array.isArray(list) ? list.slice(0, 200).map(sanitizeCustomRecipe).filter(Boolean) : [];
}

// --- Code foyer : généré au hasard et vérifié ---
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 signes, sans I/O/0/1 (faciles à confondre)
function generateHouseholdCode() {
  const bytes = new Uint8Array(12);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
  const c = Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `FOYER-${c.slice(0, 4).join('')}-${c.slice(4, 8).join('')}-${c.slice(8, 12).join('')}`;
}
function isWeakHouseholdCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length < 12 || !/[0-9]/.test(c) || !/[A-Z]/.test(c) || new Set(c).size < 6;
}

// --- Notifications (avec action « Annuler » possible) ---
let toastTimer = null;
function showToast(text, opts = {}) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  host.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'app-toast';
  el.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  if (opts.action && typeof opts.onAction === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opts.action;
    btn.addEventListener('click', () => {
      clearTimeout(toastTimer);
      host.innerHTML = '';
      opts.onAction();
    });
    el.appendChild(btn);
  }
  host.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => { if (el.parentNode === host) host.removeChild(el); }, 220);
  }, opts.duration || (opts.action ? 5500 : 2600));
}
function showSyncToast(text) { showToast(text); }

// --- Boîtes de dialogue intégrées (remplacent alert / confirm / prompt) ---
function openDialog(opts) {
  return new Promise(resolve => {
    const {
      title = '', message = '', confirmLabel = 'OK', cancelLabel = 'Annuler',
      danger = false, hideCancel = false, input = null
    } = opts;
    const previouslyFocused = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'dlg-backdrop';
    const box = document.createElement('div');
    box.className = 'dlg';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    const titleId = 'dlg-title-' + Date.now();
    box.setAttribute('aria-labelledby', titleId);

    const h = document.createElement('h3');
    h.className = 'dlg-title';
    h.id = titleId;
    h.textContent = title;
    box.appendChild(h);

    if (message) {
      const p = document.createElement('p');
      p.className = 'dlg-msg';
      p.textContent = message;
      box.appendChild(p);
    }

    let field = null;
    if (input) {
      field = document.createElement(input.multiline ? 'textarea' : 'input');
      field.className = 'dlg-input';
      if (!input.multiline) { field.type = 'text'; field.maxLength = 80; }
      else { field.rows = 6; field.readOnly = true; }
      field.value = input.value || '';
      if (input.placeholder) field.placeholder = input.placeholder;
      box.appendChild(field);
    }

    const actions = document.createElement('div');
    actions.className = 'dlg-actions';
    const cancelValue = input ? null : false;
    let cancelBtn = null;
    if (!hideCancel) {
      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'dlg-btn';
      cancelBtn.textContent = cancelLabel;
      actions.appendChild(cancelBtn);
    }
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'dlg-btn dlg-primary' + (danger ? ' dlg-danger' : '');
    okBtn.textContent = confirmLabel;
    actions.appendChild(okBtn);
    box.appendChild(actions);
    backdrop.appendChild(box);

    function finish(value) {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      updateScrollLock();
      if (previouslyFocused && previouslyFocused.focus) { try { previouslyFocused.focus(); } catch (e) {} }
      resolve(value);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(hideCancel ? (input ? field.value : true) : cancelValue); }
      else if (e.key === 'Enter' && !(field && field.tagName === 'TEXTAREA')) { e.preventDefault(); okBtn.click(); }
    }
    if (cancelBtn) cancelBtn.addEventListener('click', () => finish(cancelValue));
    okBtn.addEventListener('click', () => finish(input ? field.value : true));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop && cancelBtn) finish(cancelValue); });
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(backdrop);
    updateScrollLock();
    if (field) { field.focus(); try { field.select(); } catch (e) {} } else okBtn.focus();
  });
}
function confirmDialog(opts) { return openDialog(opts); }
function promptDialog(opts) {
  return openDialog({
    ...opts,
    input: { value: opts.value, placeholder: opts.placeholder, multiline: !!opts.multiline }
  });
}

// --- Blocage du défilement derrière les fenêtres ouvertes ---
const MODAL_IDS = ['recipe-detail-modal', 'cooking-modal', 'select-meal-modal', 'custom-recipe-modal', 'saved-menus-modal'];
function updateScrollLock() {
  const anyOpen = MODAL_IDS.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  }) || !!document.querySelector('.dlg-backdrop');
  document.body.classList.toggle('scroll-locked', anyOpen);
}
function initModalBehaviour() {
  const closeButtons = {
    'custom-recipe-modal': 'btn-close-custom-recipe',
    'select-meal-modal': 'btn-close-select-meal',
    'saved-menus-modal': 'btn-close-saved-menus',
    'cooking-modal': 'btn-close-cooking',
    'recipe-detail-modal': 'btn-close-detail'
  };
  // Les fenêtres où un appui involontaire sur le fond ne fait rien perdre se ferment en touchant le fond
  const closeOnBackdrop = ['recipe-detail-modal', 'select-meal-modal', 'saved-menus-modal'];
  MODAL_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(updateScrollLock).observe(el, { attributes: true, attributeFilter: ['class'] });
    if (closeOnBackdrop.includes(id)) {
      el.addEventListener('click', (e) => {
        if (e.target === el) { const b = document.getElementById(closeButtons[id]); if (b) b.click(); }
      });
    }
  });
  // Touche Échap : ferme la fenêtre du dessus
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('.dlg-backdrop')) return;
    for (const id of MODAL_IDS) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) {
        const b = document.getElementById(closeButtons[id]);
        if (b) b.click();
        break;
      }
    }
  });
  updateScrollLock();
}

// --- Annuler une action (menu vidé, repas retiré, articles décochés…) ---
function takeSnapshot() {
  return JSON.stringify({
    plan: state.plan,
    lockedSlots: state.lockedSlots,
    checkedGroceries: state.checkedGroceries,
    staples: state.staples
  });
}
function restoreSnapshot(snapshot) {
  try {
    const s = JSON.parse(snapshot);
    state.plan = sanitizePlan(s.plan);
    state.lockedSlots = sanitizeSlots(s.lockedSlots);
    state.checkedGroceries = sanitizeChecked(s.checkedGroceries);
    state.staples = sanitizeStaples(s.staples);
  } catch (e) { return; }
  saveToLocalStorage();
  renderAll();
}

const DEFAULT_RECIPES = window.DEFAULT_RECIPES || [];
const GRAND_FRAIS_RAYONS = window.GRAND_FRAIS_RAYONS || [];

// Constantes des jours de la semaine
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// État initial de l'application
let state = {
  portions: 4, // 2 dîners + 2 gamelles par défaut
  recipes: [],
  plan: [], // liste ordonnée d'identifiants de recettes choisies (sans restriction de jour ni de nombre)
  lockedSlots: [], // [slotIndex, ...] indices des plats verrouillés/gardés (non cuisinés)
  savedMenus: [], // [ { id, name, date, portions, plan, staples } ]
  staples: [], // Produits courants hors-recettes [ { id, name, checked } ]
  checkedGroceries: {}, // { 'item-key': true/false }
  activeFilter: 'all',
  sortOption: 'default',
  searchQuery: '',
  selectingSlot: null,
  activeDetailRecipeId: null,
  cookingRecipe: null,
  cookingStepIndex: 0,
  activeTimers: {},
  wakeLock: null,
  // Synchronisation Foyer en Direct
  householdCode: safeGetItem('gamelle_household_code') || '',
  lastSyncTimestamp: parseInt(safeGetItem('gamelle_last_sync') || '0', 10),
  deviceId: safeGetItem('gamelle_device_id') || ('dev-' + Math.random().toString(36).substring(2, 9)),
  syncEventSource: null,
  syncDebounceTimer: null,
  favorites: [] // IDs des recettes favorites
};

// Catalogue : affichage progressif (24 plats à la fois)
const CATALOG_PAGE = 24;
let catalogLimit = CATALOG_PAGE;
let catalogFiltered = [];
let catalogObserver = null;
let pendingShare = null;
// ==========================================

// ==========================================
// APPARENCE (Clair / Sombre / Système)
// ==========================================
function renderThemeControl() {
  if (!window.gamelleTheme) return;
  const pref = window.gamelleTheme.get();
  document.querySelectorAll('[data-theme-pref]').forEach(btn => {
    const active = btn.dataset.themePref === pref;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const hint = document.getElementById('theme-hint');
  if (hint) {
    hint.textContent = pref === 'light' ? 'Toujours clair sur cet appareil'
      : pref === 'dark' ? 'Toujours sombre sur cet appareil'
      : 'Suit automatiquement le réglage de votre iPhone';
  }
}

function init() {
  
  // Persister deviceId pour distinguer nos propres messages de ceux du conjoint
  if (!safeGetItem('gamelle_device_id')) {
    safeSetItem('gamelle_device_id', state.deviceId);
  }

  loadFromLocalStorage();
  checkUrlParamsForSharing();
  setupEventListeners();
  renderAll();
  renderThemeControl();
  initModalBehaviour();
  initConnectivityNotices();
  restoreLastTab();
  registerServiceWorker();
  updateQRCode();
  initHouseholdSync();
  updateSyncStatusUI();

  // Écouter le retour au premier plan (iPhone Safari) pour récupérer les courses fraîches
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      pollLatestSync();
      checkForAppUpdate();
    }
  });

  applyPendingShare();
}

// Dernier onglet ouvert : on y revient à la réouverture de l'app
function restoreLastTab() {
  const last = safeGetItem('gamelle_tab');
  if (last && last !== 'tab-planning' && document.getElementById(last)) switchTab(last);
}

function initConnectivityNotices() {
  window.addEventListener('offline', () => showToast('Hors ligne : vos listes restent disponibles'));
  window.addEventListener('online', () => {
    showToast('Connexion rétablie');
    pollLatestSync();
  });
}

function loadFromLocalStorage() {
  // Recettes : catalogue + recettes maison (validées)
  state.recipes = [...DEFAULT_RECIPES, ...sanitizeRecipeList(readJSON('gamelle_custom_recipes', []))];

  const savedPortions = parseInt(safeGetItem('gamelle_portions'), 10);
  if (Number.isFinite(savedPortions)) state.portions = Math.min(12, Math.max(1, savedPortions));

  // Plats gardés (chargés avant toute génération de menu)
  state.lockedSlots = sanitizeSlots(readJSON('gamelle_locked_slots', []));

  // Planning (support migration objet {Lundi: ...} -> tableau [])
  let plan = readJSON('gamelle_plan', null);
  if (plan && !Array.isArray(plan) && typeof plan === 'object') plan = Object.values(plan);
  state.plan = Array.isArray(plan) ? sanitizePlan(plan) : [];
  if (state.plan.length === 0) generateBalancedWeek();

  state.savedMenus = sanitizeSavedMenus(readJSON('gamelle_saved_menus', []));
  state.staples = sanitizeStaples(readJSON('gamelle_staples', []));
  state.favorites = sanitizeStringList(readJSON('gamelle_favorites', []));
  state.checkedGroceries = sanitizeChecked(readJSON('gamelle_checked', {}));
}

function saveToLocalStorage() {
  safeSetItem('gamelle_portions', state.portions);
  safeSetItem('gamelle_plan', JSON.stringify(state.plan));
  safeSetItem('gamelle_saved_menus', JSON.stringify(state.savedMenus));
  safeSetItem('gamelle_staples', JSON.stringify(state.staples));
  safeSetItem('gamelle_checked', JSON.stringify(state.checkedGroceries));
  safeSetItem('gamelle_locked_slots', JSON.stringify(state.lockedSlots || []));
  safeSetItem('gamelle_favorites', JSON.stringify(state.favorites || []));
  const customList = (state.recipes || []).filter(r => r.id.startsWith('custom-'));
  safeSetItem('gamelle_custom_recipes', JSON.stringify(customList));
  updateQRCode();
  broadcastSync();
}

function checkUrlParamsForSharing() {
  const params = new URLSearchParams(window.location.search);
  const household = cleanStr(params.get('household') || '', 60).toUpperCase();
  const menuParam = params.get('menu');
  if (!household && !menuParam) return;

  pendingShare = { household: household || null, menu: null };

  if (menuParam) {
    const ids = menuParam.split(',').map(s => cleanStr(s, 80)).filter(Boolean).slice(0, 60);
    let staples = null;
    const rawStaples = params.get('staples');
    if (rawStaples) {
      try {
        const decoded = JSON.parse(rawStaples);
        if (Array.isArray(decoded)) {
          staples = sanitizeStaples(decoded.map(item => (
            typeof item === 'string' ? { name: item } : { name: item && item.n, checked: !!item && item.c === 1 }
          )));
        }
      } catch (e) {
        console.warn('Erreur lecture des articles courants partagés', e);
      }
    }
    pendingShare.menu = {
      ids,
      portions: Math.round(cleanNum(params.get('portions'), 1, 12, state.portions)),
      staples
    };
  }

  // L'adresse est nettoyée tout de suite : le code foyer ne reste pas dans l'historique
  window.history.replaceState({}, document.title, window.location.pathname);
}

// Importer un menu partagé ou rejoindre un foyer : toujours avec l'accord de l'utilisateur
async function applyPendingShare() {
  if (!pendingShare) return;
  const share = pendingShare;
  pendingShare = null;

  if (share.menu && share.menu.ids.length > 0) {
    const ok = await confirmDialog({
      title: 'Importer le menu partagé ?',
      message: `${share.menu.ids.length} repas et la liste de courses associée. Votre planning actuel sera remplacé.`,
      confirmLabel: 'Importer'
    });
    if (ok) {
      state.plan = share.menu.ids;
      state.lockedSlots = [];
      state.checkedGroceries = {};
      state.portions = share.menu.portions;
      if (share.menu.staples) state.staples = share.menu.staples;
      saveToLocalStorage();
      renderAll();
      showToast('Menu et courses importés');
    }
  }

  if (share.household && share.household !== state.householdCode) {
    const ok = await confirmDialog({
      title: 'Rejoindre ce foyer ?',
      message: `Code « ${share.household} ». Votre menu, vos recettes et vos courses seront synchronisés avec ce foyer.`,
      confirmLabel: 'Rejoindre'
    });
    if (ok) setHouseholdCode(share.household);
  }
}

// ==========================================
// GESTION DES REPAS & PLANNING
// ==========================================
function generateBalancedWeek(forceAll = false) {
  const volailles = state.recipes.filter(r => r.type === 'volaille');
  const poissons = state.recipes.filter(r => r.type === 'poisson');
  const veges = state.recipes.filter(r => r.type === 'vege' || r.type === 'vegetarien');
  const viandes = state.recipes.filter(r => r.type === 'viande');

  const shuffle = (arr) => [...arr].sort(() => 0.5 - Math.random());

  const targetCount = 7;
  const lockedIndices = (!forceAll && Array.isArray(state.lockedSlots)) ? state.lockedSlots : [];

  // Si tous les plats sont verrouillés, avertir l'utilisateur
  if (lockedIndices.length >= targetCount && state.plan.length >= targetCount) {
    showToast('Tous vos repas sont gardés : retirez-en un pour renouveler le menu');
    return;
  }

  // Plats verrouillés à préserver
  const lockedRecipeIds = new Set();
  const newPlan = [];

  for (let i = 0; i < targetCount; i++) {
    if (lockedIndices.includes(i) && state.plan[i]) {
      newPlan[i] = state.plan[i];
      lockedRecipeIds.add(state.plan[i]);
    } else {
      newPlan[i] = null;
    }
  }

  // Pools de recettes sans les recettes déjà verrouillées
  const availableVolailles = shuffle(volailles.filter(r => !lockedRecipeIds.has(r.id)));
  const availablePoissons = shuffle(poissons.filter(r => !lockedRecipeIds.has(r.id)));
  const availableVeges = shuffle(veges.filter(r => !lockedRecipeIds.has(r.id)));
  const availableViandes = shuffle(viandes.filter(r => !lockedRecipeIds.has(r.id)));

  const targetTypes = ['vege', 'viande', 'poisson', 'volaille', 'viande', 'poisson', 'volaille'];

  for (let i = 0; i < targetCount; i++) {
    if (newPlan[i] !== null) continue; // Déjà verrouillé

    const preferredType = targetTypes[i % targetTypes.length];
    let candidate = null;

    if (preferredType === 'vege' && availableVeges.length > 0) candidate = availableVeges.shift();
    else if (preferredType === 'viande' && availableViandes.length > 0) candidate = availableViandes.shift();
    else if (preferredType === 'poisson' && availablePoissons.length > 0) candidate = availablePoissons.shift();
    else if (preferredType === 'volaille' && availableVolailles.length > 0) candidate = availableVolailles.shift();

    if (!candidate) {
      const allLeft = [...availableVeges, ...availableVolailles, ...availablePoissons, ...availableViandes];
      candidate = allLeft[0] || state.recipes[Math.floor(Math.random() * state.recipes.length)];
    }

    if (candidate) {
      newPlan[i] = candidate.id;
      lockedRecipeIds.add(candidate.id);
    }
  }

  state.plan = newPlan.filter(Boolean);
  state.lockedSlots = state.lockedSlots.filter(idx => idx < state.plan.length);
  state.checkedGroceries = {};
  saveToLocalStorage();
  renderAll();
}

function toggleLockSlot(slotIndex) {
  if (!Array.isArray(state.lockedSlots)) state.lockedSlots = [];
  const isCurrentlyLocked = state.lockedSlots.includes(slotIndex);
  if (isCurrentlyLocked) {
    state.lockedSlots = state.lockedSlots.filter(s => s !== slotIndex);
  } else {
    state.lockedSlots.push(slotIndex);
  }
  saveToLocalStorage();
  renderPlanning();
  renderGroceries();
  broadcastSync();
  showToast(!isCurrentlyLocked ? 'Repas gardé : ses ingrédients sont retirés des courses' : 'Repas remis dans les courses');
}

function removeMealSlot(slotIndex) {
  const snapshot = takeSnapshot();
  state.plan.splice(slotIndex, 1);
  if (Array.isArray(state.lockedSlots)) {
    state.lockedSlots = state.lockedSlots
      .filter(s => s !== slotIndex)
      .map(s => (s > slotIndex ? s - 1 : s));
  }
  saveToLocalStorage();
  renderPlanning();
  renderGroceries();
  showToast('Repas retiré', { action: 'Annuler', onAction: () => restoreSnapshot(snapshot) });
}

async function clearMenu() {
  if (state.plan.length === 0) { showToast('Le menu est déjà vide'); return; }
  const ok = await confirmDialog({
    title: 'Vider le menu ?',
    message: 'Tous les repas seront retirés de votre planning.',
    confirmLabel: 'Vider',
    danger: true
  });
  if (!ok) return;
  const snapshot = takeSnapshot();
  state.plan = [];
  state.lockedSlots = [];
  state.checkedGroceries = {};
  saveToLocalStorage();
  renderAll();
  showToast('Menu vidé', { action: 'Annuler', onAction: () => restoreSnapshot(snapshot) });
}

async function saveCurrentMenu() {
  if (!state.plan.some(Boolean)) { showToast("Ajoutez d'abord des repas au menu"); return; }
  const defaultTitle = `Menu du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
  const name = await promptDialog({
    title: 'Enregistrer ce menu',
    message: 'Donnez-lui un nom pour le retrouver dans « Mes menus ».',
    value: defaultTitle,
    confirmLabel: 'Enregistrer'
  });
  if (name === null || !cleanStr(name, 80)) return;

  const newMenu = {
    id: 'menu_' + Date.now(),
    name: cleanStr(name, 80),
    date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    portions: state.portions,
    plan: Array.isArray(state.plan) ? [...state.plan] : Object.values(state.plan),
    staples: [...state.staples]
  };

  if (!state.savedMenus) state.savedMenus = [];
  state.savedMenus.unshift(newMenu);
  if (state.savedMenus.length > 15) state.savedMenus.pop();
  saveToLocalStorage();
  renderPlanning();
  showToast(`Menu « ${newMenu.name} » enregistré`);
}

function openSavedMenusModal() {
  const modal = document.getElementById('saved-menus-modal');
  if (!modal) return;
  renderSavedMenusList();
  modal.classList.remove('hidden');
}

function closeSavedMenusModal() {
  const modal = document.getElementById('saved-menus-modal');
  if (modal) modal.classList.add('hidden');
}

function renderSavedMenusList() {
  const container = document.getElementById('saved-menus-list');
  if (!container) return;
  container.innerHTML = '';

  if (!state.savedMenus || state.savedMenus.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 space-y-2">
        <span class="text-3xl block">📁</span>
        <p class="text-xs font-semibold text-slate-600">Aucun menu sauvegardé pour le moment</p>
        <p class="text-[11px]">Enregistrez votre menu en cours pour le recharger quand vous voulez sans perdre vos plats.</p>
      </div>
    `;
    return;
  }

  state.savedMenus.forEach(menu => {
    const planArr = Array.isArray(menu.plan) ? menu.plan : Object.values(menu.plan || {});
    const count = planArr.filter(Boolean).length;
    const card = document.createElement('div');
    card.className = 'ios-card p-3.5 flex items-center justify-between gap-3 border border-slate-100 hover:border-brand-200 transition-all';
    card.innerHTML = `
      <div class="flex-1 min-w-0">
        <h4 class="font-bold text-xs text-slate-800 truncate">${esc(menu.name)}</h4>
        <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
          <span>📅 ${esc(menu.date)}</span>
          <span>•</span>
          <span class="font-semibold text-emerald-700">${count} repas</span>
          <span>•</span>
          <span>${menu.portions || 4} parts</span>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button class="btn-load-saved-menu bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs px-2.5 py-1.5 rounded-lg active:scale-95 transition-all" data-id="${esc(menu.id)}">
          Charger
        </button>
        <button class="btn-delete-saved-menu text-slate-300 hover:text-red-500 text-xs px-2 py-1.5" data-id="${esc(menu.id)}" title="Supprimer" aria-label="Supprimer ce menu">
          🗑️
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.btn-load-saved-menu').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const menu = state.savedMenus.find(m => m.id === id);
      if (!menu) return;
      const ok = await confirmDialog({
        title: `Charger « ${menu.name} » ?`,
        message: 'Votre planning actuel sera remplacé par ce menu.',
        confirmLabel: 'Charger'
      });
      if (!ok) return;
      const snapshot = takeSnapshot();
      state.plan = Array.isArray(menu.plan) ? [...menu.plan] : Object.values(menu.plan || {}).filter(Boolean);
      state.lockedSlots = [];
      state.portions = menu.portions || state.portions;
      if (menu.staples && Array.isArray(menu.staples)) state.staples = [...menu.staples];
      saveToLocalStorage();
      renderAll();
      closeSavedMenusModal();
      showToast(`Menu « ${menu.name} » chargé`, { action: 'Annuler', onAction: () => restoreSnapshot(snapshot) });
    });
  });

  container.querySelectorAll('.btn-delete-saved-menu').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const before = JSON.stringify(state.savedMenus);
      state.savedMenus = state.savedMenus.filter(m => m.id !== id);
      saveToLocalStorage();
      renderSavedMenusList();
      renderPlanning();
      showToast('Menu supprimé', { action: 'Annuler', onAction: () => {
        state.savedMenus = sanitizeSavedMenus(JSON.parse(before));
        saveToLocalStorage();
        renderSavedMenusList();
        renderPlanning();
      } });
    });
  });
}

// ==========================================
// HARMONISATION & AGRÉGATION DE LA LISTE DE COURSES
// ==========================================

// --- Unités canoniques -------------------------------------------------------
// Toutes les unités écrites dans les recettes (« pièces », « cuillère à soupe »,
// « litre », « grosses pièces »…) sont ramenées à une forme unique.
function canonicalUnit(rawUnit) {
  const s = (rawUnit || '').toString().toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '');

  if (!s) return 'piece';
  if (['g', 'gr', 'gramme', 'grammes'].includes(s)) return 'g';
  if (['kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes'].includes(s)) return 'kg';
  if (['ml', 'millilitre', 'millilitres'].includes(s)) return 'ml';
  if (['cl', 'centilitre', 'centilitres'].includes(s)) return 'cl';
  if (['l', 'litre', 'litres'].includes(s)) return 'l';
  if (/^(c\.?\s*a\.?\s*s|cas|cs|c\.?\s*s|cuil+eres?\s+a\s+soupe|c\.?\s*a\s+soupe|c\s+a\s+soupe)$/.test(s)) return 'c. à soupe';
  if (/^(c\.?\s*a\.?\s*c|cac|cc|c\.?\s*c|cuil+eres?\s+a\s+cafe|c\.?\s*a\s+cafe|c\s+a\s+cafe)$/.test(s)) return 'c. à café';
  if (/^((grosses?|petites?|moyennes?)\s+)?(pieces?|unites?|escalopes?)$/.test(s)) return 'piece';
  if (/^gousses?$/.test(s)) return 'gousse';
  if (/^bottes?$/.test(s)) return 'botte';
  if (/^bouquets?$/.test(s)) return 'bouquet';
  if (/^tiges?$/.test(s)) return 'tige';
  if (/^branches?$/.test(s)) return 'branche';
  if (/^brins?$/.test(s)) return 'brin';
  if (/^tetes?$/.test(s)) return 'tete';
  if (/^tranches?$/.test(s)) return 'tranche';
  if (/^(paves?|dos)$/.test(s)) return 'pave';
  if (/^oeufs?$/.test(s)) return 'oeuf';
  if (/^(sachets?|salades?)$/.test(s)) return 'sachet';
  if (/^pincees?$/.test(s)) return 'pincee';
  if (/^portions?$/.test(s)) return 'portion';
  if (/^poignees?$/.test(s)) return 'poignee';
  if (/^quartiers?$/.test(s)) return 'quartier';
  if (/^pots?$/.test(s)) return 'pot';
  if (/^cubes?$/.test(s)) return 'cube';
  if (/^(boites?|conserves?)$/.test(s)) return 'boite';
  if (/^paquets?$/.test(s)) return 'paquet';
  if (/^(cm|centimetres?)$/.test(s)) return 'cm';
  if (/^morceaux?$/.test(s)) return 'morceau';
  if (/^bouteilles?$/.test(s)) return 'bouteille';
  return s;
}

// Poids (g) et volumes (ml) : convertibles entre eux (densité ≈ 1 pour la cuisine)
const MASS_FACTORS = { g: 1, kg: 1000 };
const VOLUME_FACTORS = { ml: 1, cl: 10, l: 1000, 'c. à soupe': 15, 'c. à café': 5, pincee: 0.5 };

function unitToGrams(unit) {
  if (MASS_FACTORS[unit]) return MASS_FACTORS[unit];
  if (VOLUME_FACTORS[unit]) return VOLUME_FACTORS[unit];
  return null;
}

// Poids moyen d'une unité « comptable » pour chaque ingrédient harmonisé (en g, ou ml pour les liquides)
// → permet d'additionner « 2 pièces de patate douce » et « 600 g de patate douce ».
const UNIT_WEIGHTS = {
  "Patates douces": { piece: 300 },
  "Pommes de terre fraîches": { piece: 150 },
  "Oignons jaunes": { piece: 120 },
  "Oignons rouges": { piece: 120 },
  "Échalotes": { piece: 30 },
  "Oignons nouveaux (cébettes)": { botte: 150, piece: 30, tige: 30 },
  "Blancs de poireaux": { piece: 150 },
  "Carottes fraîches": { piece: 100 },
  "Courgettes fraîches": { piece: 250 },
  "Aubergines fraîches": { piece: 300 },
  "Tomates fraîches": { piece: 120 },
  "Champignons de Paris frais": { piece: 20, barquette: 250 },
  "Chou-fleur frais": { piece: 800, tete: 800 },
  "Brocoli frais": { tete: 400, piece: 400 },
  "Pousses d'épinards frais": { sachet: 120, poignee: 30 },
  "Poivrons (rouges ou tricolores)": { piece: 150 },
  "Courge Butternut": { piece: 1000 },
  "Potimarron frais": { piece: 1000 },
  "Citrons verts": { piece: 60 },
  "Citrons jaunes": { piece: 110 },
  "Citrons confits": { piece: 60 },
  "Bananes fraîches": { piece: 120 },
  "Avocats mûrs": { piece: 200 },
  "Concombre frais": { piece: 300 },
  "Salade verte (mâche ou roquette)": { sachet: 125, poignee: 30, piece: 300 },
  "Gousses d'ail": { gousse: 5, piece: 5, tete: 50 },
  "Gingembre frais": { cm: 5, morceau: 15 },
  "Basilic frais": { botte: 30, bouquet: 30, brin: 1, tige: 1, poignee: 10, pincee: 0.3, 'c. à café': 1 },
  "Thym frais": { botte: 20, bouquet: 20, branche: 1, brin: 1, tige: 1, pincee: 0.3, 'c. à café': 1 },
  "Romarin frais": { botte: 20, bouquet: 20, branche: 2, brin: 2, tige: 2, pincee: 0.3, 'c. à café': 1 },
  "Menthe fraîche": { botte: 30, bouquet: 30, brin: 1, tige: 1, poignee: 10, pincee: 0.3 },
  "Persil plat frais": { botte: 50, bouquet: 50, brin: 3, tige: 3, poignee: 10 },
  "Coriandre fraîche": { botte: 50, bouquet: 50, brin: 3, tige: 3, poignee: 10 },
  "Ciboulette fraîche": { botte: 30, bouquet: 30, brin: 2, tige: 2, poignee: 10 },
  "Aneth frais": { botte: 30, bouquet: 30, brin: 3, tige: 3, poignee: 10 },
  "Petits pois frais (ou surgelés)": { poignee: 40 },
  "Haricots verts fins frais": { poignee: 50 },
  "Bœuf haché frais (pur bœuf)": { piece: 125 },
  "Bavette ou rumsteck de bœuf": { piece: 150 },
  "Chorizo en tranches": { tranche: 5, piece: 200 },
  "Lardons fumés pur porc": { sachet: 200, paquet: 200, barquette: 200 },
  "Saucisses de volaille": { piece: 80 },
  "Saucisses de Toulouse ou fumées": { piece: 100 },
  "Cuisses de poulet fraîches": { piece: 250 },
  "Filets de poulet frais": { piece: 150, morceau: 150 },
  "Escalopes de dinde fraîches": { piece: 130 },
  "Cuisses de canard confites": { piece: 250 },
  "Filet de porc français": { piece: 150 },
  "Veau français (sauté ou blanquette)": { piece: 150 },
  "Jambon blanc supérieur": { tranche: 40 },
  "Pavés de saumon frais": { pave: 130, piece: 130 },
  "Dos de cabillaud / Poisson blanc frais": { pave: 140, piece: 140 },
  "Saumon fumé de qualité": { tranche: 25 },
  "Œufs frais": { oeuf: 55, piece: 55 },
  "Mozzarella (boule ou râpée)": { piece: 125 },
  "Feta AOP": { piece: 200 },
  "Bûche de chèvre frais": { piece: 180 },
  "Reblochon de Savoie AOP": { piece: 450 },
  "Crème fraîche (épaisse ou liquide)": { pot: 200 },
  "Fromage blanc (ou ricotta)": { pot: 500 },
  "Pâte à tarte (feuilletée ou brisée)": { piece: 230 },
  "Pain de campagne (ou pain de mie)": { tranche: 35, piece: 250 },
  "Pois chiches (bocal)": { boite: 400, pot: 400 },
  "Haricots rouges (bocal)": { boite: 400, pot: 400 },
  "Haricots noirs (bocal)": { boite: 400, pot: 400 },
  "Lait de coco": { boite: 400, piece: 400 },
  "Tomates concassées / Coulis": { boite: 400, piece: 400 },
  "Thon au naturel (boîte)": { boite: 140, piece: 140 },
  "Maïs doux en boîte": { boite: 285, piece: 285 },
  "Bouillon (volaille ou légumes)": { cube: 500 },
  "Gnocchis à poêler": { sachet: 500, paquet: 500 },
  "Falafels prêts à dorer": { piece: 25 },
  "Galettes de sarrasin (blé noir)": { piece: 50 }
};

// Unités qui s'achètent à l'unité (on arrondit à l'unité supérieure dans la liste de courses)
const COUNT_UNITS = ['piece', 'gousse', 'botte', 'bouquet', 'tige', 'branche', 'brin', 'tete', 'tranche', 'pave', 'oeuf', 'sachet', 'portion', 'poignee', 'quartier', 'pot', 'cube', 'boite', 'paquet', 'morceau', 'bouteille'];

// Convertit une quantité d'une unité vers une autre pour un ingrédient donné.
// Renvoie null si la conversion n'a pas de sens (on garde alors une ligne séparée).
function convertQuantity(qty, fromUnit, toUnit, ingredientName) {
  if (fromUnit === toUnit) return qty;
  const weights = UNIT_WEIGHTS[ingredientName] || {};

  const fromG = unitToGrams(fromUnit) ?? weights[fromUnit] ?? null;
  const toG = unitToGrams(toUnit) ?? weights[toUnit] ?? null;
  if (fromG == null || toG == null) return null;
  return (qty * fromG) / toG;
}

// Fonction de formatage d'unité et quantité respectant la grammaire française
// forShopping = true : arrondi pratique pour acheter (2,3 oignons → 3 pièces)
function formatQuantityAndUnit(quantity, baseUnit, itemName = '', forShopping = false) {
  let q = Number(quantity) || 0;
  let unit = canonicalUnit(baseUnit);

  // Poids : tout en grammes, puis kg au-delà de 1000 g
  if (unit === 'kg') { q *= 1000; unit = 'g'; }
  if (unit === 'g') {
    if (q >= 1000) {
      const kg = Math.round((q / 1000) * 10) / 10;
      return `${kg.toString().replace('.', ',')} kg`;
    }
    if (forShopping && q > 50) q = Math.ceil(q / 10) * 10;
    return `${Math.max(1, Math.round(q))} g`;
  }

  // Volumes : tout en ml, puis L au-delà de 1000 ml
  if (unit === 'cl') { q *= 10; unit = 'ml'; }
  if (unit === 'l') { q *= 1000; unit = 'ml'; }
  if (unit === 'ml') {
    if (q >= 1000) {
      const l = Math.round((q / 1000) * 10) / 10;
      return `${l.toString().replace('.', ',')} L`;
    }
    if (forShopping && q > 50) q = Math.ceil(q / 10) * 10;
    return `${Math.max(1, Math.round(q))} ml`;
  }

  if (forShopping && (COUNT_UNITS.includes(unit) || unit === 'c. à soupe' || unit === 'c. à café')) {
    q = Math.max(1, Math.ceil(q - 0.15));
  } else {
    q = Math.round(q * 10) / 10;
  }

  const numStr = Number.isInteger(q) ? q.toString() : q.toString().replace('.', ',');
  const isPlural = q >= 2;
  const lowerName = (itemName || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');

  // Évite les doublons d'unité si le libellé de l'ingrédient l'exprime déjà
  if (unit === 'oeuf' && lowerName.includes('oeuf')) return numStr;
  if (unit === 'gousse' && lowerName.includes('gousse')) return numStr;
  if (unit === 'pave' && lowerName.includes('pave')) return numStr;
  if (unit === 'tranche' && lowerName.includes('tranche')) return numStr;
  if (unit === 'botte' && lowerName.includes('botte')) return numStr;

  const LABELS = {
    piece: ['pièce', 'pièces'], gousse: ['gousse', 'gousses'], botte: ['botte', 'bottes'],
    bouquet: ['bouquet', 'bouquets'], tige: ['tige', 'tiges'], branche: ['branche', 'branches'],
    brin: ['brin', 'brins'], tete: ['tête', 'têtes'], tranche: ['tranche', 'tranches'],
    pave: ['pavé', 'pavés'], oeuf: ['œuf', 'œufs'], sachet: ['sachet', 'sachets'],
    pincee: ['pincée', 'pincées'], portion: ['portion', 'portions'], poignee: ['poignée', 'poignées'],
    quartier: ['quartier', 'quartiers'], pot: ['pot', 'pots'], cube: ['cube', 'cubes'],
    boite: ['boîte', 'boîtes'], paquet: ['paquet', 'paquets'], morceau: ['morceau', 'morceaux'],
    bouteille: ['bouteille', 'bouteilles'], cm: ['cm', 'cm'],
    'c. à soupe': ['c. à soupe', 'c. à soupe'], 'c. à café': ['c. à café', 'c. à café']
  };
  const label = LABELS[unit] ? LABELS[unit][isPlural ? 1 : 0] : unit;
  return `${numStr} ${label}`.trim();
}
function normalizeIngredient(ing) {
  const raw = (ing.name || '').toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .trim();

  let name = (ing.name || '').trim();
  // Unité d'origine harmonisée (« pièces », « cuillère à soupe », « litre »… → forme unique).
  // Les règles ci-dessous fixent l'unité CIBLE de la liste de courses ; la quantité est
  // convertie ensuite dans computeGroceries() grâce à convertQuantity().
  let unit = canonicalUnit(ing.unit);
  let quantity = ing.quantity || 1;
  let rayon = ing.rayon || 'epicerie';
  if (unit === 'kg') { quantity *= 1000; unit = 'g'; }
  else if (unit === 'cl') { quantity *= 10; unit = 'ml'; }
  else if (unit === 'l') { quantity *= 1000; unit = 'ml'; }

  // --- 1. CRÈMERIE & PRODUITS LAITIERS ---
  // Pâtes à tarte AVANT le beurre pour éviter qu'une "pâte feuilletée pur beurre" devienne du beurre
  // Regroupements : un même produit écrit de plusieurs façons = une seule ligne de courses
  if (/\bbouquet\s+garni\b/.test(raw)) {
    name = "Bouquet garni"; unit = "piece"; rayon = "fruits-legumes";
  } else if (/\bbasilic\b/.test(raw)) {
    name = "Basilic frais"; unit = "botte"; rayon = "fruits-legumes";
  } else if (/\bthym\b/.test(raw)) {
    name = "Thym frais"; unit = "botte"; rayon = "fruits-legumes";
  } else if (/\bromarin\b/.test(raw)) {
    name = "Romarin frais"; unit = "botte"; rayon = "fruits-legumes";
  } else if (/\bmenthe\b/.test(raw)) {
    name = "Menthe fraîche"; unit = "botte"; rayon = "fruits-legumes";
  } else if (/\bcacahuetes?\b/.test(raw) && !/beurre/.test(raw)) {
    name = "Cacahuètes grillées"; unit = "g"; rayon = "epicerie";
  } else if (/\btortillas?\b/.test(raw)) {
    name = "Tortillas de blé"; unit = "piece"; rayon = "epicerie";
  } else if (/\bmarrons?\b/.test(raw)) {
    name = "Marrons cuits"; unit = "g"; rayon = "epicerie";
  } else if (/\boranges?\b/.test(raw) && !/\bjus\b/.test(raw)) {
    name = "Oranges"; unit = "piece"; rayon = "fruits-legumes";
  } else if (/\bpousses?\s+de\s+(soja|haricots?\s+mungo)\b/.test(raw)) {
    name = "Pousses de soja"; unit = "g"; rayon = "fruits-legumes";
  } else if (/\bfromage\s+frais\s+a\s+tartiner\b/.test(raw)) {
    name = "Fromage frais à tartiner"; unit = "g"; rayon = "cremerie";
  } else if (/\bepices?\s+mexicaines?\b/.test(raw)) {
    name = "Épices mexicaines"; rayon = "epicerie";
  } else if (/\b(pate\s+feuilletee|feuilletage|pate\s+brisee|pate\s+a\s+tarte)\b/.test(raw)) {
    name = "Pâte à tarte (feuilletée ou brisée)";
    unit = "piece";
    rayon = "cremerie";
  } else if (/\bbeurre\b/.test(raw) && !raw.includes("cacahu")) {
    name = "Beurre (doux ou demi-sel)";
    unit = "g";
    rayon = "cremerie";
  } else if ((/\b(oeufs?|oeufs?)\b/.test(raw) && !raw.includes('lasagne') && !raw.includes('pate')) || unit === 'oeuf') {
    name = "Œufs frais";
    unit = "oeuf";
    rayon = "cremerie";
  } else if (/\bcreme\b/.test(raw) && !raw.includes("ail") && !raw.includes("avocat")) {
    name = "Crème fraîche (épaisse ou liquide)";
    unit = 'ml';
    rayon = "cremerie";
  } else if (/\blait\b/.test(raw) && !raw.includes("coco")) {
    name = "Lait (demi-écrémé ou entier)";
    unit = "ml";
    rayon = "cremerie";
  } else if (/\b(mozzarella|mozza)\b/.test(raw)) {
    name = "Mozzarella (boule ou râpée)";
    unit = (unit === 'g' ? 'g' : 'piece');
    rayon = "cremerie";
  } else if (/\bparmesan\b/.test(raw)) {
    name = "Parmesan AOP râpé";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bemmental\b/.test(raw)) {
    name = "Emmental râpé";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bcomte\b/.test(raw)) {
    name = "Comté AOP râpé";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bchevre\b/.test(raw)) {
    name = "Bûche de chèvre frais";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bfeta\b/.test(raw)) {
    name = "Feta AOP";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bricotta\b/.test(raw)) {
    name = "Ricotta fraîche";
    unit = "g";
    rayon = "cremerie";
  } else if (/\breblochon\b/.test(raw)) {
    name = "Reblochon de Savoie AOP";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bgorgonzola\b/.test(raw)) {
    name = "Gorgonzola AOP";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bfromage\s+blanc\b/.test(raw)) {
    name = "Fromage blanc (ou ricotta)";
    unit = "g";
    rayon = "cremerie";
  } else if (/\bkefir\b/.test(raw)) {
    name = "Kéfir (bouteille)";
    unit = "bouteille";
    rayon = "cremerie";
  } else if (/\byaourts?\b/.test(raw)) {
    name = "Yaourts (nature ou aux fruits)";
    unit = "pot";
    rayon = "cremerie";
  } else if (/\b(galettes?.*(sarrasin|ble\s+noir|bretonne)|crepes?.*sarrasin)\b/.test(raw)) {
    name = "Galettes de sarrasin (blé noir)";
    unit = "piece";
    rayon = "cremerie";
  }

  // --- 2. HUILES, VINAIGRES & CONDIMENTS (Épicerie - AVANT olives & pâtes) ---
  else if (/\bhuile.*olive\b/.test(raw) || (raw.includes("huile") && raw.includes("olive"))) {
    name = "Huile d'olive vierge extra";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\bhuile.*sesame\b/.test(raw)) {
    name = "Huile de sésame";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(beurre\s+de\s+cacahuete|beurre\s+d'arachide)\b/.test(raw)) {
    name = "Beurre de cacahuète (pot)";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(sauce\s+soja\s+sucree|soja\s+sucree)\b/.test(raw)) {
    name = "Sauce soja sucrée";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(sauce\s+soja|soja\s+salee)\b/.test(raw)) {
    name = "Sauce soja salée";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(sauce\s+teriyaki|teriyaki)\b/.test(raw)) {
    name = "Sauce teriyaki";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(vinaigre.*balsamique|balsamique)\b/.test(raw)) {
    name = "Vinaigre balsamique";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(vinaigre.*cidre|vinaigre.*vin|vinaigre)\b/.test(raw)) {
    name = "Vinaigre de cidre (ou vin)";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(moutarde.*ancienne|moutarde.*dijon|moutarde)\b/.test(raw)) {
    name = "Moutarde à l'ancienne ou Dijon";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\bmiel\b/.test(raw)) {
    name = "Miel toutes fleurs";
    unit = "c. à soupe";
    rayon = "epicerie";
  }

  // --- 3. ÉPICES, CURRY & CONDIMENTS SECS (AVANT PÂTES DE BLÉ) ---
  else if (/\b(curry|pate\s+de\s+curry)\b/.test(raw)) {
    name = "Pâte ou poudre de curry doux";
    unit = (unit === 'c. à soupe' ? 'c. à soupe' : 'c. à café');
    rayon = "epicerie";
  } else if (/\bcurcuma\b/.test(raw)) {
    name = "Curcuma en poudre";
    unit = "c. à café";
    rayon = "epicerie";
  } else if (/\b(cumin|cumin\s+en\s+poudre)\b/.test(raw)) {
    name = "Cumin en poudre";
    unit = "c. à café";
    rayon = "epicerie";
  } else if (/\b(paprika|paprika\s+fume)\b/.test(raw)) {
    name = "Paprika doux (ou fumé)";
    unit = "c. à café";
    rayon = "epicerie";
  } else if (/\b(epices?\s+cajun|cajun|epices?\s+fajitas?|epices?\s+chili)\b/.test(raw) || (raw.includes("epices") && (raw.includes("fajita") || raw.includes("chili")))) {
    name = "Mélange d'épices (Fajitas / Chili)";
    unit = "c. à café";
    rayon = "epicerie";
  } else if (/\bherbes?\s+de\s+provence\b/.test(raw) || /\borigan\b/.test(raw)) {
    name = "Herbes de Provence sèches";
    unit = "c. à café";
    rayon = "epicerie";
  } else if (/\bnoix\s+de\s+muscade\b/.test(raw) || /\bmuscade\b/.test(raw)) {
    name = "Noix de muscade râpée";
    unit = "pincee";
    rayon = "epicerie";
  } else if (/\bcannelle\b/.test(raw)) {
    name = "Cannelle en poudre";
    unit = "c. à café";
    rayon = "epicerie";
  } else if (/\bgraines?\s+de\s+sesame\b/.test(raw)) {
    name = "Graines de sésame";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\bgraines?\s+de\s+courge\b/.test(raw)) {
    name = "Graines de courge";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\bnoix\s+de\s+cajou\b/.test(raw)) {
    name = "Noix de cajou non salées";
    unit = "g";
    rayon = "epicerie";
  } else if (/\b(noix|cerneaux\s+de\s+noix)\b/.test(raw) && !raw.includes("saint-jacques") && !raw.includes("st-jacques")) {
    name = "Cerneaux de noix";
    unit = "g";
    rayon = "fruits-legumes";
  } else if (/\b(noisettes?|amandes?)\b/.test(raw)) {
    name = "Noisettes ou amandes décortiquées";
    unit = "g";
    rayon = "fruits-legumes";
  }

  // --- 4. FRUITS & LÉGUMES FRAIS ---
  else if (/\b(ail|gousses?\s+d'ail)\b/.test(raw) && !raw.includes("creme d'ail")) {
    name = "Gousses d'ail";
    unit = "gousse";
    rayon = "fruits-legumes";
  } else if (/\boignons?\s+rouges?\b/.test(raw)) {
    name = "Oignons rouges";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\b(cebettes?|oignons?\s+nouveaux?)\b/.test(raw)) {
    name = "Oignons nouveaux (cébettes)";
    unit = "botte";
    rayon = "fruits-legumes";
  } else if (/\bechalotes?\b/.test(raw)) {
    name = "Échalotes";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bconfit.*oignons?\b/.test(raw)) {
    name = "Confit d'oignons";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\b(oignons?|ognons?)\b/.test(raw)) {
    name = "Oignons jaunes";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bpoireaux?\b/.test(raw)) {
    name = "Blancs de poireaux";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bcarottes?\b/.test(raw)) {
    name = "Carottes fraîches";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bcourgettes?\b/.test(raw)) {
    name = "Courgettes fraîches";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\baubergines?\b/.test(raw)) {
    name = "Aubergines fraîches";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\btomates?\b/.test(raw) && !raw.includes("concasse") && !raw.includes("coulis") && !raw.includes("concentre") && !raw.includes("seche") && !raw.includes("pelee") && !raw.includes("pulpe")) {
    name = "Tomates fraîches";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bchampignons?\b/.test(raw)) {
    name = "Champignons de Paris frais";
    unit = "g";
    rayon = "fruits-legumes";
  } else if (/\bchou.*fleur\b/.test(raw)) {
    name = "Chou-fleur frais";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bbrocolis?\b/.test(raw)) {
    name = "Brocoli frais";
    unit = "tete";
    rayon = "fruits-legumes";
  } else if (/\bepinards?\b/.test(raw)) {
    name = "Pousses d'épinards frais";
    unit = "g";
    rayon = "fruits-legumes";
  } else if (/\bpoivrons?\b/.test(raw)) {
    name = "Poivrons (rouges ou tricolores)";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bpatates?\s+douces?\b/.test(raw)) {
    name = "Patates douces";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bpommes?\s+de\s+terre\b/.test(raw)) {
    name = "Pommes de terre fraîches";
    unit = "g";
    rayon = "fruits-legumes";
  } else if (/\bbutternut\b/.test(raw)) {
    name = "Courge Butternut";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bpotimarron\b/.test(raw)) {
    name = "Potimarron frais";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bcitrons?\s+verts?\b/.test(raw)) {
    name = "Citrons verts";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bcitrons?\s+confits?\b/.test(raw)) {
    name = "Citrons confits";
    unit = "piece";
    rayon = "epicerie";
  } else if (/\bcitrons?\b/.test(raw) && !raw.startsWith("jus de citron")) {
    name = "Citrons jaunes";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bbananes?\b/.test(raw)) {
    name = "Bananes fraîches";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bfruits?\b/.test(raw) && !raw.includes("mer") && !raw.includes("sec") && !raw.includes("passion")) {
    name = "Fruits frais de saison";
    unit = "portion";
    rayon = "fruits-legumes";
  } else if (/\bavocats?\b/.test(raw)) {
    name = "Avocats mûrs";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\bconcombres?\b/.test(raw)) {
    name = "Concombre frais";
    unit = "piece";
    rayon = "fruits-legumes";
  } else if (/\b(salades?|maches?|roquettes?|jeunes pousses)\b/.test(raw)) {
    name = "Salade verte (mâche ou roquette)";
    unit = (unit === "g" ? "g" : "sachet");
    rayon = "fruits-legumes";
  } else if (/\bpersil\b/.test(raw)) {
    name = "Persil plat frais";
    unit = "botte";
    rayon = "fruits-legumes";
  } else if (/\bcoriandre\b/.test(raw)) {
    name = "Coriandre fraîche";
    unit = "botte";
    rayon = "fruits-legumes";
  } else if (/\bciboulette\b/.test(raw)) {
    name = "Ciboulette fraîche";
    unit = "botte";
    rayon = "fruits-legumes";
  } else if (/\baneth\b/.test(raw)) {
    name = "Aneth frais";
    unit = "botte";
    rayon = "fruits-legumes";
  } else if (/\bgingembre\b/.test(raw)) {
    name = "Gingembre frais";
    unit = "c. à café";
    rayon = "fruits-legumes";
  } else if (/\bpetits?\s+pois\b/.test(raw)) {
    name = "Petits pois frais (ou surgelés)";
    unit = "g";
    rayon = "fruits-legumes";
  } else if (/\babricots?\s+secs?\b/.test(raw)) {
    name = "Abricots secs moelleux";
    unit = "g";
    rayon = "fruits-legumes";
  } else if (/\bharicots?\s+verts?\b/.test(raw) || /\bpois gourmands?\b/.test(raw)) {
    name = "Haricots verts fins frais";
    unit = "g";
    rayon = "fruits-legumes";
  }

  // --- 5. BOUCHERIE & VOLAILLES ---
  // GLOBALISATION BŒUF (haché, à sauter, à mijoter) : regroupe pur bœuf, bœuf cuit, steak haché, etc.
  else if ((/\bhach(e|ee|es|ees)?\b/.test(raw) && /\bboeuf\b/.test(raw)) || /\bpur\s+boeuf\b/.test(raw) || /\bboeuf\s+cuit\b/.test(raw) || /\bsteak\s+hache\b/.test(raw) || /\bviande\s+hachee\b/.test(raw)) {
    name = "Bœuf haché frais (pur bœuf)";
    unit = "g";
    rayon = "boucherie";
  } else if (/\b(bavette|rumsteck|hampe|onglet|faux-filet)\b/.test(raw) || (/\bboeuf\b/.test(raw) && /\b(saute|piece|lamelles?|poeler)\b/.test(raw))) {
    name = "Bavette ou rumsteck de bœuf";
    unit = "g";
    rayon = "boucherie";
  } else if (/\b(paleron|gite|macreuse|bourguignon|ragout)\b/.test(raw) || (/\bboeuf\b/.test(raw) && !raw.includes("bouillon") && !raw.includes("sauce"))) {
    name = "Bœuf à mijoter (paleron ou gîte)";
    unit = "g";
    rayon = "boucherie";
  }
  // CHARCUTERIE & VOLAILLE
  else if (/\b(chorizo|saucisse.*seche)\b/.test(raw)) {
    name = "Chorizo en tranches";
    unit = "g";
    rayon = "boucherie";
  } else if (/\b(lardons?|pancetta|poitrine\s+fumee)\b/.test(raw)) {
    name = "Lardons fumés pur porc";
    unit = "g";
    rayon = "boucherie";
  } else if (/\bsaucisses?\s+de\s+volaille\b/.test(raw)) {
    name = "Saucisses de volaille";
    unit = "piece";
    rayon = "boucherie";
  } else if (/\bsaucisses?\b/.test(raw)) {
    name = "Saucisses de Toulouse ou fumées";
    unit = "piece";
    rayon = "boucherie";
  } else if (/\bcuisses?\s+de\s+poulet\b/.test(raw)) {
    name = "Cuisses de poulet fraîches";
    unit = "piece";
    rayon = "boucherie";
  } else if (/\b(poulet|blancs?\s+de\s+poulet|filets?\s+de\s+poulet|aiguillettes?\s+de\s+poulet|escalope.*poulet)\b/.test(raw) && !raw.includes("bouillon")) {
    name = "Filets de poulet frais";
    unit = "g";
    rayon = "boucherie";
  } else if (/\bdinde\b/.test(raw)) {
    name = "Escalopes de dinde fraîches";
    unit = "g";
    rayon = "boucherie";
  } else if (/\bcanard\b/.test(raw)) {
    name = "Cuisses de canard confites";
    unit = "piece";
    rayon = "boucherie";
  } else if (/\bveau\b/.test(raw) && !raw.includes("bouillon")) {
    name = "Veau français (sauté ou blanquette)";
    unit = "g";
    rayon = "boucherie";
  } else if (/\bagneau\b/.test(raw)) {
    name = "Sauté d'agneau en morceaux";
    unit = "g";
    rayon = "boucherie";
  } else if (/\b(porc|filet mignon)\b/.test(raw)) {
    name = "Filet de porc français";
    unit = "g";
    rayon = "boucherie";
  } else if (/\bjambon\b/.test(raw)) {
    name = "Jambon blanc supérieur";
    unit = "tranche";
    rayon = "boucherie";
  }

  // --- 6. POISSONNERIE & MARÉE ---
  else if (/\b(saint-jacques|st-jacques|coquilles?\s+saint-jacques)\b/.test(raw)) {
    name = "Noix de Saint-Jacques fraîches";
    unit = "g";
    rayon = "poissonnerie";
  } else if (/\bsaumon\b/.test(raw) && (raw.includes("fume") || raw.includes("truite"))) {
    name = "Saumon fumé de qualité";
    unit = "g";
    rayon = "poissonnerie";
  } else if (/\bsaumon\b/.test(raw)) {
    name = "Pavés de saumon frais";
    unit = "pave";
    rayon = "poissonnerie";
  } else if (/\bcrevettes?\b/.test(raw)) {
    name = "Crevettes cuites décortiquées";
    unit = "g";
    rayon = "poissonnerie";
  } else if (/\b(cabillaud|lieu noir|colin|merlu)\b/.test(raw)) {
    name = "Dos de cabillaud / Poisson blanc frais";
    unit = (unit === 'pave' ? 'pave' : 'g');
    rayon = "poissonnerie";
  }

  // --- 7. ÉPICERIE SALÉE & FÉCULENTS ---
  else if (/\bkit.*fajita\b/.test(raw)) {
    name = "Kit pour fajitas (galettes & épices)";
    unit = "piece";
    rayon = "epicerie";
  } else if (/\bpommes?\s+noisettes?\b/.test(raw)) {
    name = "Pommes noisettes (surgelées ou fraîches)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\b(riz.*risotto|arborio|carnaroli)\b/.test(raw)) {
    name = "Riz à risotto (Arborio ou Carnaroli)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\briz\b/.test(raw) && !raw.includes("vermicelle") && !raw.includes("nouille")) {
    name = "Riz blanc (basmati ou jasmin)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\blasagnes?\b/.test(raw)) {
    name = "Plaques de lasagne aux œufs";
    unit = "g";
    rayon = "epicerie";
  } else if (/\b(pates?|penne|tagliatelles?|spaghettis?|coquillettes?|fusilli|linguine)\b/.test(raw)) {
    name = "Pâtes de blé (penne, fusilli ou coquillettes)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bgnocchis?\b/.test(raw)) {
    name = "Gnocchis à poêler";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bnouilles?\b/.test(raw)) {
    name = "Nouilles asiatiques (blé ou soba)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\b(quinoa|semoule|boulghour|couscous)\b/.test(raw)) {
    name = "Quinoa ou semoule complète";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bpesto\b/.test(raw)) {
    name = "Pesto alla genovese (pot)";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\bpois\s+chiches?\b/.test(raw)) {
    name = "Pois chiches (bocal)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bharicots?\s+noirs?\b/.test(raw)) {
    name = "Haricots noirs (bocal)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bharicots?\s+rouges?\b/.test(raw)) {
    name = "Haricots rouges (bocal)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\blentilles?\s+corail\b/.test(raw)) {
    name = "Lentilles corail";
    unit = "g";
    rayon = "epicerie";
  } else if (/\blentilles?\s+vertes?\b/.test(raw)) {
    name = "Lentilles vertes françaises";
    unit = "g";
    rayon = "epicerie";
  } else if (/\blait\s+de\s+coco\b/.test(raw)) {
    name = "Lait de coco";
    unit = "ml";
    rayon = "epicerie";
  } else if (/\b(coulis|pulpe|tomates?\s+concassees?|puree.*tomates?|tomates?\s+pelees?)\b/.test(raw)) {
    name = "Tomates concassées / Coulis";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bconcentre.*tomates?\b/.test(raw)) {
    name = "Concentré de tomate";
    unit = "c. à soupe";
    rayon = "epicerie";
  } else if (/\bthon\b/.test(raw)) {
    name = "Thon au naturel (boîte)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bbouillon\b/.test(raw)) {
    name = "Bouillon (volaille ou légumes)";
    unit = "ml";
    rayon = "epicerie";
  } else if (/\b(pain\s+de\s+mie|pain)\b/.test(raw)) {
    name = "Pain de campagne (ou pain de mie)";
    unit = "tranche";
    rayon = "epicerie";
  } else if (/\bchapelure\b/.test(raw) || /\bpanko\b/.test(raw)) {
    name = "Chapelure fine (ou panko)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bolives?\b/.test(raw)) {
    name = "Olives (noires ou vertes)";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bfalafels?\b/.test(raw)) {
    name = "Falafels prêts à dorer";
    unit = "piece";
    rayon = "epicerie";
  } else if (/\bhoumous\b/.test(raw)) {
    name = "Houmous classique";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bflocons?\s+d'avoine\b/.test(raw)) {
    name = "Flocons d'avoine";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bfarine\b/.test(raw) || /\bmaizena\b/.test(raw) || /\bfecule\b/.test(raw)) {
    name = "Farine de blé ou fécule";
    unit = "g";
    rayon = "epicerie";
  } else if (/\bmais\b/.test(raw)) {
    name = "Maïs doux en boîte";
    unit = "g";
    rayon = "epicerie";
  } else if (/\b(vin\s+blanc|vin\s+blanc\s+sec)\b/.test(raw)) {
    name = "Vin blanc sec de cuisine";
    unit = "ml";
    rayon = "epicerie";
  } else if (/\bvin\s+rouge\b/.test(raw)) {
    name = "Vin rouge de cuisine";
    unit = "ml";
    rayon = "epicerie";
  }

  return { name, quantity, unit, rayon };
}

function computeGroceries() {
  // Regroupement par ingrédient harmonisé (rayon + nom), indépendamment de l'unité d'origine :
  // « 2 grosses pièces de patate douce » + « 600 g de patate douce » → « 4 pièces (≈ 1,2 kg) »
  const aggregated = {};

  // Supporte plan en tableau ([id1,id2,...]) ou objet legacy ({Lundi: id,...})
  const planEntries = Array.isArray(state.plan)
    ? state.plan.map((id, idx) => ({ id, slotIndex: idx }))
    : Object.entries(state.plan).map(([key, id], idx) => ({ id, slotIndex: idx, dayKey: key }));

  planEntries.forEach(({ id: recipeId, slotIndex }) => {
    if (!recipeId) return;

    // Repas dont les ingrédients sont déjà à la maison (verrouillé / gardé au menu)
    if (Array.isArray(state.lockedSlots) && state.lockedSlots.includes(slotIndex)) {
      return;
    }

    const recipe = state.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const ratio = state.portions / (recipe.basePortions || 4);

    (recipe.ingredients || []).forEach(rawIng => {
      const norm = normalizeIngredient(rawIng);
      const targetUnit = canonicalUnit(norm.unit);
      let sourceUnit = canonicalUnit(rawIng.unit);
      let qty = (Number(rawIng.quantity) || 1) * ratio;

      // Réparation des anciennes recettes maison enregistrées avec « 600 pièces » au lieu de « 600 g »
      if (recipe.id && recipe.id.startsWith('custom-') && COUNT_UNITS.includes(sourceUnit)
          && (Number(rawIng.quantity) || 0) >= 40 && (UNIT_WEIGHTS[norm.name] || {})[sourceUnit]) {
        sourceUnit = 'g';
      }

      const key = norm.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!aggregated[key]) {
        aggregated[key] = {
          id: key,
          name: norm.name,
          rayon: norm.rayon,
          targetUnit,
          amounts: {},          // { unité: quantité } (unité cible + unités non convertibles)
          massFromConversion: 0,
          convertedFromMass: false,
          legacyIds: new Set(),
          recipes: []
        };
      }
      const item = aggregated[key];
      item.legacyIds.add(`${norm.rayon}__${norm.name.toLowerCase().trim()}__${norm.unit}`);

      const converted = convertQuantity(qty, sourceUnit, item.targetUnit, norm.name);
      if (converted !== null) {
        item.amounts[item.targetUnit] = (item.amounts[item.targetUnit] || 0) + converted;
        if (sourceUnit !== item.targetUnit && unitToGrams(sourceUnit) && COUNT_UNITS.includes(item.targetUnit)) {
          item.convertedFromMass = true;
        }
      } else {
        item.amounts[sourceUnit] = (item.amounts[sourceUnit] || 0) + qty;
      }

      if (!item.recipes.includes(recipe.title)) item.recipes.push(recipe.title);
    });
  });

  return Object.values(aggregated).map(item => {
    const units = Object.keys(item.amounts);
    // Unité cible en premier, puis les éventuelles unités non convertibles
    units.sort((a, b) => (a === item.targetUnit ? -1 : b === item.targetUnit ? 1 : 0));
    const parts = units.map(u => formatQuantityAndUnit(item.amounts[u], u, item.name, true));
    let formatted = parts.join(' + ');

    // Indication du poids total quand on a additionné des grammes à des pièces
    const w = (UNIT_WEIGHTS[item.name] || {})[item.targetUnit];
    if (item.convertedFromMass && w && units.length === 1) {
      const count = Math.max(1, Math.ceil(item.amounts[item.targetUnit] - 0.15));
      formatted += ` <span class="font-medium text-slate-400">(≈ ${formatQuantityAndUnit(count * w, 'g')})</span>`;
    }

    // Conserver les articles déjà cochés avec l'ancienne clé (unité incluse)
    if (state.checkedGroceries[item.id] === undefined) {
      for (const legacy of item.legacyIds) {
        if (state.checkedGroceries[legacy]) { state.checkedGroceries[item.id] = true; break; }
      }
    }

    item.quantity = item.amounts[item.targetUnit] || 0;
    item.baseUnit = item.targetUnit;
    item.unit = item.targetUnit;
    item.formattedQty = formatted;
    item.formattedQtyText = formatted.replace(/<[^>]+>/g, '');
    delete item.legacyIds;
    return item;
  });
}

// ==========================================
function renderAll() {
  document.getElementById('current-portions-badge').textContent = `${state.portions} part${state.portions > 1 ? 's' : ''}`;

  // Mettre à jour le sous-titre de la bannière planning si présent
  const planningSubtitle = document.getElementById('planning-portions-subtitle');
  if (planningSubtitle) {
    planningSubtitle.textContent = '';
  }

  // Mettre à jour le modal de choix de plat si présent
  const modalSelectPortions = document.getElementById('modal-select-meal-portions');
  if (modalSelectPortions) {
    modalSelectPortions.textContent = `${state.portions} portion${state.portions > 1 ? 's' : ''}`;
  }

  // Si le modal de détail d'une recette est actuellement ouvert, rafraîchir ses quantités immédiatement
  const detailModal = document.getElementById('recipe-detail-modal');
  if (detailModal && !detailModal.classList.contains('hidden') && state.activeDetailRecipeId) {
    openRecipeDetail(state.activeDetailRecipeId);
  }

  // Si le mode cuisine est ouvert, le rafraîchir
  const cookingModal = document.getElementById('cooking-modal');
  if (cookingModal && !cookingModal.classList.contains('hidden') && state.cookingRecipe) {
    document.getElementById('cooking-recipe-portions').textContent = `🥘 ${state.portions} portions`;
    renderCookingStep();
  }

  renderPlanning();
  renderGroceries();
  renderCatalog();
}

// 1. Rendu du Planning (liste de plats sans limitation de nombre ni de jours fixes)
function renderPlanning() {
  const container = document.getElementById('weekly-days-list');
  if (!container) return;
  container.innerHTML = '';

  // Mettre à jour le badge du nombre de menus sauvegardés
  const countBadge = document.getElementById('saved-menus-count');
  if (countBadge) {
    countBadge.textContent = state.savedMenus ? state.savedMenus.length : 0;
  }

  // Header avec compteur de plats et bouton d'ajout rapide
  const lockedCount = Array.isArray(state.lockedSlots)
    ? state.lockedSlots.filter(idx => idx < state.plan.length && Boolean(state.plan[idx])).length
    : 0;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'flex items-center justify-between px-1 pb-1 flex-wrap gap-2';
  headerDiv.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs font-bold text-slate-700">${state.plan.length} repas sélectionné${state.plan.length > 1 ? 's' : ''}</span>
    </div>
    <button id="btn-add-meal-slot" class="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition-all">
      <span>+</span> Ajouter un plat
    </button>
  `;
  container.appendChild(headerDiv);

  headerDiv.querySelector('#btn-add-meal-slot').addEventListener('click', () => {
    addMealSlot();
  });

  // Liste des repas
  state.plan.forEach((recipeId, slotIndex) => {
    const recipe = state.recipes.find(r => r.id === recipeId);
    const card = document.createElement('div');
    const isLocked = Array.isArray(state.lockedSlots) && state.lockedSlots.includes(slotIndex);

    card.className = `ios-card p-3.5 flex flex-col gap-2.5 transition-all ${
      isLocked ? 'border-amber-300 bg-amber-50/25 ring-1 ring-amber-200' : ''
    }`;

    if (recipe) {
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-xs ${isLocked ? 'text-amber-900 bg-amber-100' : 'text-slate-800 bg-slate-100'} px-2.5 py-1 rounded-lg">Repas ${slotIndex + 1}</span>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="btn-lock-meal text-xs font-semibold px-2.5 py-1 rounded-lg transition-all border flex items-center gap-1 ${
              isLocked 
                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 shadow-xs' 
                : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-900'
            }" data-slot="${slotIndex}" title="${isLocked ? 'Plat gardé (non ajouté aux courses)' : 'Garder ce plat (ne pas ajouter aux courses)'}">
              ${isLocked ? ICONS.lock : ICONS.unlock}
              <span>${isLocked ? 'Gardé' : 'Garder'}</span>
            </button>
            <button class="btn-change-meal text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg font-medium transition-colors" data-slot="${slotIndex}">
              Changer
            </button>
            <button class="btn-remove-meal text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors" data-slot="${slotIndex}" title="Retirer ce plat">
              ✕
            </button>
          </div>
        </div>
        
        <div class="flex items-center gap-3.5 cursor-pointer btn-open-detail py-0.5" data-id="${esc(recipe.id)}">
          <img src="${esc(safeImg(recipe.image))}" alt="" loading="lazy" decoding="async" onerror="imgFallback(this)" class="img-soft w-16 h-16 rounded-2xl object-cover shadow-sm flex-shrink-0">
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-sm text-slate-900 leading-snug">${esc(recipe.title)}</h3>
            <p class="text-[11px] text-slate-500 line-clamp-1 mt-0.5">${esc(recipe.description)}</p>
            <div class="flex items-center gap-2 mt-1.5 text-[11px] text-slate-600 font-medium flex-wrap">
              <span>⏱️ ${recipe.timeMinutes} min</span>
              <span>•</span>
              <span class="text-emerald-700 font-semibold">${esc(recipe.tag)}</span>
              ${recipe.isBudget ? `<span class="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-md">💰 Pas cher</span>` : ''}
            </div>
          </div>
          <span class="text-slate-300 text-lg font-bold pr-1 flex-shrink-0">›</span>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">Repas ${slotIndex + 1}</span>
          <button class="btn-remove-meal text-xs text-slate-400 hover:text-red-500 px-2 py-1" data-slot="${slotIndex}">✕</button>
        </div>
        <button class="btn-choose-meal w-full py-3 border-2 border-dashed border-slate-200 hover:border-brand-500 rounded-xl text-slate-500 hover:text-brand-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all" data-slot="${slotIndex}">
          <span>+</span> Choisir une recette
        </button>
      `;
    }

    container.appendChild(card);
  });

  if (state.plan.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'ios-card p-8 text-center text-slate-400 space-y-2';
    emptyNotice.innerHTML = `
      <span class="text-3xl block">🍽️</span>
      <p class="text-xs font-semibold text-slate-600">Aucun plat dans votre menu</p>
      <p class="text-[11px]">Cliquez sur « Générer 7 repas » ou ajoutez vos plats préférés depuis l'onglet Recettes.</p>
    `;
    container.appendChild(emptyNotice);
  }

  // Écouteurs pour le planning
  container.querySelectorAll('.btn-lock-meal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = parseInt(e.currentTarget.dataset.slot, 10);
      toggleLockSlot(slot);
    });
  });

  container.querySelectorAll('.btn-change-meal, .btn-choose-meal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const slot = parseInt(e.currentTarget.dataset.slot, 10);
      openSelectMealModal(slot);
    });
  });

  container.querySelectorAll('.btn-remove-meal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const slot = parseInt(e.currentTarget.dataset.slot, 10);
      removeMealSlot(slot);
    });
  });

  container.querySelectorAll('.btn-open-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const recipeId = e.currentTarget.dataset.id;
      openRecipeDetail(recipeId);
    });
  });
}

function addRecipeToPlan(recipeId) {
  state.plan.push(recipeId);
  saveToLocalStorage();
  renderPlanning();
  renderGroceries();
  showToast(`Ajouté au menu (repas ${state.plan.length})`, { action: 'Voir', onAction: () => switchTab('tab-planning') });
}

function addMealSlot(recipeId = null) {
  if (recipeId) {
    state.plan.push(recipeId);
    saveToLocalStorage();
    renderPlanning();
    renderGroceries();
  } else {
    state.plan.push(null);
    const newSlotIndex = state.plan.length - 1;
    saveToLocalStorage();
    renderPlanning();
    openSelectMealModal(newSlotIndex);
  }
}
// 2. Rendu de la Liste de Courses Grand Frais
function renderGroceries() {
  const container = document.getElementById('grand-frais-aisles-container');
  container.innerHTML = '';

  const groceries = computeGroceries();
  let totalItems = groceries.length + state.staples.length;
  let checkedCount = 0;

  // Calcul du nombre de cochés
  groceries.forEach(item => {
    if (state.checkedGroceries[item.id]) checkedCount++;
  });
  state.staples.forEach(staple => {
    if (staple.checked) checkedCount++;
  });

  // Mise à jour de la barre de progression
  const percentage = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
  document.getElementById('courses-progress-bar').style.width = `${percentage}%`;
  document.getElementById('courses-stats-label').textContent = `${checkedCount} / ${totalItems} article${totalItems > 1 ? 's' : ''} trouvé${checkedCount > 1 ? 's' : ''} (${percentage}%)`;
  
  // Badge sur l'onglet inférieur
  const navBadge = document.getElementById('nav-badge-groceries');
  if (totalItems > 0) {
    navBadge.textContent = totalItems - checkedCount;
    navBadge.classList.toggle('hidden', totalItems - checkedCount === 0);
  } else {
    navBadge.classList.add('hidden');
  }

  // Bannière informative si des repas sont gardés avec ingrédients déjà à la maison
  const lockedCount = Array.isArray(state.lockedSlots)
    ? state.lockedSlots.filter(idx => idx < (state.plan || []).length && Boolean(state.plan[idx])).length
    : 0;

  if (lockedCount > 0) {
    const lockedMealsBanner = document.createElement('div');
    lockedMealsBanner.className = 'ios-card bg-amber-50/80 border border-amber-200/90 p-3 mb-3.5 flex items-start gap-2.5 text-xs text-amber-900 rounded-2xl shadow-xs';
    lockedMealsBanner.innerHTML = `
      <span class="text-lg flex-shrink-0 leading-none mt-0.5">🔒</span>
      <div class="flex-1">
        <div class="flex items-center justify-between gap-1 flex-wrap">
          <p class="font-bold text-amber-950">${lockedCount} repas gardé${lockedCount > 1 ? 's' : ''} au menu</p>
          <span class="text-[10px] bg-amber-200/60 text-amber-900 font-semibold px-2 py-0.5 rounded-full">Déjà à la maison</span>
        </div>
        <p class="text-[11px] text-amber-800/90 mt-1 leading-relaxed">
          Les ingrédients de ce${lockedCount > 1 ? 's repas sont déjà dans vos placards/frigo' : ' repas sont déjà dans vos placards/frigo'} et sont <strong>exclus</strong> de votre liste de courses pour le week-end.
        </p>
      </div>
    `;
    container.appendChild(lockedMealsBanner);
  }

  // Rendu de chaque rayon Grand Frais
  GRAND_FRAIS_RAYONS.forEach(rayon => {
    const isStapleRayon = rayon.id === 'courants';
    let itemsInRayon = isStapleRayon 
      ? [...state.staples] 
      : groceries.filter(g => g.rayon === rayon.id);

    if (itemsInRayon.length === 0) return;

    // Tri : les articles restants à acheter en haut, les articles cochés envoyés en bas du rayon
    itemsInRayon.sort((a, b) => {
      const aChecked = isStapleRayon ? (a.checked ? 1 : 0) : (state.checkedGroceries[a.id] ? 1 : 0);
      const bChecked = isStapleRayon ? (b.checked ? 1 : 0) : (state.checkedGroceries[b.id] ? 1 : 0);
      if (aChecked !== bChecked) {
        return aChecked - bChecked; // 0 (non coché) avant 1 (coché)
      }
      return a.name.localeCompare(b.name, 'fr');
    });

    const section = document.createElement('div');
    section.className = 'ios-card overflow-hidden';

    // En-tête du rayon
    section.innerHTML = `
      <div class="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">${rayon.icon}</span>
          <div>
            <h3 class="font-bold text-xs text-slate-800">${rayon.name}</h3>
            <span class="text-[10px] text-slate-400">${rayon.desc}</span>
          </div>
        </div>
        <span class="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
          ${itemsInRayon.length}
        </span>
      </div>
      <div class="divide-y divide-slate-100 items-list-container">
      </div>
    `;

    const listContainer = section.querySelector('.items-list-container');

    itemsInRayon.forEach(item => {
      const itemRow = document.createElement('div');
      itemRow.className = 'p-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors';

      const isChecked = isStapleRayon 
        ? item.checked 
        : !!state.checkedGroceries[item.id];

      // Quantité harmonisée et formatée
      let qtyStr = '';
      if (!isStapleRayon) {
        qtyStr = item.formattedQty || formatQuantityAndUnit(item.quantity, item.baseUnit || item.unit);
      }

      itemRow.innerHTML = `
        <label class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
          <input type="checkbox" class="grocery-check w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 rounded cursor-pointer" data-id="${esc(item.id)}" data-type="${isStapleRayon ? 'staple' : 'recipe'}" ${isChecked ? 'checked' : ''} aria-label="${esc(item.name)}">
          <div class="flex-1 min-w-0 ${isChecked ? 'item-checked' : ''}">
            <div class="flex items-baseline gap-1.5 flex-wrap">
              ${qtyStr ? `<span class="font-bold text-xs text-brand-700">${qtyStr}</span>` : ''}
              <span class="text-xs text-slate-800 font-medium">${esc(item.name)}</span>
            </div>
            ${item.recipes && item.recipes.length > 0 ? `
              <span class="text-[10px] text-slate-400 truncate block">(${esc(item.recipes.join(', '))})</span>
            ` : ''}
          </div>
        </label>
        ${isStapleRayon ? `
          <button class="btn-delete-staple text-slate-300 hover:text-red-500 text-xs px-1" data-id="${esc(item.id)}" aria-label="Retirer ${esc(item.name)}">✕</button>
        ` : ''}
      `;

      listContainer.appendChild(itemRow);
    });

    container.appendChild(section);
  });

  if (totalItems === 0) {
    container.innerHTML = `
      <div class="ios-card p-8 text-center text-slate-400 space-y-2">
        <span class="text-3xl block">🥦</span>
        <p class="text-xs font-semibold text-slate-600">Votre liste de courses est vide</p>
        <p class="text-[11px]">Choisissez vos plats dans le planning pour générer automatiquement les ingrédients par rayon Grand Frais.</p>
      </div>
    `;
  }

  // Événements pour cocher / décocher
  container.querySelectorAll('.grocery-check').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.currentTarget.dataset.id;
      const type = e.currentTarget.dataset.type;
      const checked = e.currentTarget.checked;

      if (type === 'staple') {
        const item = state.staples.find(s => s.id === id);
        if (item) item.checked = checked;
      } else {
        state.checkedGroceries[id] = checked;
      }

      saveToLocalStorage();
      renderGroceries();
    });
  });

  // Suppression des produits courants individuels
  container.querySelectorAll('.btn-delete-staple').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const snapshot = takeSnapshot();
      state.staples = state.staples.filter(s => s.id !== id);
      saveToLocalStorage();
      renderGroceries();
      showToast('Produit retiré', { action: 'Annuler', onAction: () => restoreSnapshot(snapshot) });
    });
  });
}

// 3. Rendu du Catalogue de Recettes (affichage progressif, photos différées)
function recipeCardHTML(recipe) {
  const isFav = state.favorites.includes(recipe.id);
  const isCustom = recipe.id.startsWith('custom-');
  return `
    <div class="ios-card p-3.5 flex gap-3 hover:border-brand-300 transition-all cursor-pointer btn-open-detail" data-id="${esc(recipe.id)}" role="button" tabindex="0">
      <img src="${esc(safeImg(recipe.image))}" alt="" loading="lazy" decoding="async" onerror="imgFallback(this)" class="img-soft w-20 h-20 rounded-2xl object-cover shadow-sm flex-shrink-0">
      <div class="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-1 flex-wrap mb-0.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-600">${esc(recipe.tag)}</span>
              ${isCustom ? `<span class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md">⭐ Maison</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5">
              ${recipe.isBudget ? `<span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">💰 Pas cher</span>` : ''}
              <span class="text-[11px] text-slate-500 font-medium">⏱️ ${esc(recipe.timeMinutes)} min</span>
            </div>
          </div>
          <h3 class="font-bold text-sm text-slate-900 mt-0.5 leading-snug">${esc(recipe.title)}</h3>
          <p class="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">${esc(recipe.description)}</p>
        </div>

        <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
          <button type="button" class="btn-toggle-fav flex items-center justify-center w-8 h-8 rounded-xl transition-all ${isFav ? 'text-rose-500 bg-rose-50 hover:bg-rose-100' : 'text-slate-400 bg-slate-100 hover:text-rose-500 hover:bg-rose-50'}" data-id="${esc(recipe.id)}" title="${isFav ? 'Retirer des favoris' : 'Mettre en favori'}" aria-label="${isFav ? 'Retirer des favoris' : 'Mettre en favori'}" aria-pressed="${isFav}">${ICONS.heart(isFav)}</button>
          <button type="button" class="btn-add-to-plan bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs py-1.5 px-3 rounded-xl active:scale-95 transition-all text-center flex-shrink-0" data-id="${esc(recipe.id)}">
            + Au planning
          </button>
        </div>
      </div>
    </div>`;
}

function appendCatalogFooter(container) {
  const remaining = catalogFiltered.length - catalogLimit;
  if (catalogObserver) { catalogObserver.disconnect(); catalogObserver = null; }
  if (remaining <= 0) return;
  container.insertAdjacentHTML('beforeend', `
    <div id="catalog-more" class="text-center pt-1 pb-2">
      <button type="button" id="btn-catalog-more" class="text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-4 py-2.5 rounded-xl active:scale-95 transition-all">
        Afficher plus de plats (${remaining})
      </button>
    </div>`);
  const btn = document.getElementById('btn-catalog-more');
  if (btn && 'IntersectionObserver' in window) {
    catalogObserver = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting)) showMoreRecipes();
    }, { rootMargin: '700px 0px' });
    catalogObserver.observe(btn);
  }
}

function showMoreRecipes() {
  const container = document.getElementById('recipes-catalog-grid');
  if (!container || catalogLimit >= catalogFiltered.length) return;
  const from = catalogLimit;
  catalogLimit = Math.min(catalogFiltered.length, catalogLimit + CATALOG_PAGE);
  const more = document.getElementById('catalog-more');
  if (more) more.remove();
  container.insertAdjacentHTML('beforeend', catalogFiltered.slice(from, catalogLimit).map(recipeCardHTML).join(''));
  appendCatalogFooter(container);
}

function renderCatalog(resetLimit = false) {
  const container = document.getElementById('recipes-catalog-grid');
  if (resetLimit) catalogLimit = CATALOG_PAGE;

  let filtered = [...state.recipes];

  // Filtrage par catégorie
  if (state.activeFilter === 'budget') {
    filtered = filtered.filter(r => r.isBudget === true);
  } else if (state.activeFilter === 'automne') {
    filtered = filtered.filter(r => r.season === 'automne');
  } else if (state.activeFilter === 'hiver') {
    filtered = filtered.filter(r => r.season === 'hiver');
  } else if (state.activeFilter === 'express') {
    filtered = filtered.filter(r => r.timeMinutes <= 20);
  } else if (state.activeFilter === 'favoris') {
    filtered = filtered.filter(r => state.favorites.includes(r.id));
  } else if (state.activeFilter === 'maison') {
    filtered = filtered.filter(r => r.id.startsWith('custom-'));
  } else if (state.activeFilter !== 'all') {
    filtered = filtered.filter(r => r.type === state.activeFilter);
  }

  // Filtrage par recherche (insensible à la casse, accents et ponctuation)
  if (state.searchQuery.trim()) {
    const q = cleanSearchText(state.searchQuery);
    filtered = filtered.filter(r =>
      cleanSearchText(r.title).includes(q) ||
      cleanSearchText(r.description).includes(q) ||
      (r.ingredients && r.ingredients.some(i => cleanSearchText(i.name).includes(q)))
    );
  }

  // Tri
  if (state.sortOption === 'budget') {
    filtered.sort((a, b) => (b.isBudget ? 1 : 0) - (a.isBudget ? 1 : 0));
  } else if (state.sortOption === 'fastest') {
    filtered.sort((a, b) => a.timeMinutes - b.timeMinutes);
  }

  catalogFiltered = filtered;
  document.getElementById('recipes-count-label').textContent = `${filtered.length} plat${filtered.length > 1 ? 's' : ''} disponible${filtered.length > 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="ios-card p-8 text-center text-slate-400 space-y-2">
        <span class="text-3xl block">🔍</span>
        <p class="text-xs font-semibold text-slate-600">Aucun plat ne correspond</p>
        <p class="text-[11px]">Essayez un autre mot ou un autre filtre.</p>
      </div>`;
    return;
  }

  const visible = Math.min(catalogLimit, filtered.length);
  catalogLimit = visible;
  container.innerHTML = filtered.slice(0, visible).map(recipeCardHTML).join('');
  appendCatalogFooter(container);
}

// Un seul écouteur pour toute la grille (favoris, ajout au planning, fiche détaillée)
function setupCatalogEvents() {
  const grid = document.getElementById('recipes-catalog-grid');
  if (!grid) return;
  grid.addEventListener('click', (e) => {
    const favBtn = e.target.closest('.btn-toggle-fav');
    if (favBtn) {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.id);
      if (state.activeFilter === 'favoris') {
        renderCatalog();
      } else {
        const isFav = state.favorites.includes(favBtn.dataset.id);
        favBtn.className = `btn-toggle-fav fav-pop flex items-center justify-center w-8 h-8 rounded-xl transition-all ${isFav ? 'text-rose-500 bg-rose-50 hover:bg-rose-100' : 'text-slate-400 bg-slate-100 hover:text-rose-500 hover:bg-rose-50'}`;
        favBtn.title = isFav ? 'Retirer des favoris' : 'Mettre en favori';
        favBtn.setAttribute('aria-label', favBtn.title);
        favBtn.setAttribute('aria-pressed', String(isFav));
        favBtn.innerHTML = ICONS.heart(isFav);
      }
      return;
    }
    const addBtn = e.target.closest('.btn-add-to-plan');
    if (addBtn) {
      e.stopPropagation();
      addRecipeToPlan(addBtn.dataset.id);
      return;
    }
    if (e.target.closest('#btn-catalog-more')) { showMoreRecipes(); return; }
    const card = e.target.closest('.btn-open-detail');
    if (card) openRecipeDetail(card.dataset.id);
  });
  grid.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('btn-open-detail')) {
      e.preventDefault();
      openRecipeDetail(e.target.dataset.id);
    }
  });
}

function openSelectDayForRecipe(recipeId) {
  addRecipeToPlan(recipeId);
}

// ==========================================
// FICHE DÉTAILLÉE DE LA RECETTE (INGRÉDIENTS)
// ==========================================
function toggleFavorite(recipeId) {
  if (!Array.isArray(state.favorites)) state.favorites = [];
  if (state.favorites.includes(recipeId)) {
    state.favorites = state.favorites.filter(id => id !== recipeId);
  } else {
    state.favorites.push(recipeId);
  }
  saveToLocalStorage();
}

function updateDetailFavIcon() {
  const icon = document.getElementById('detail-fav-icon');
  if (icon && state.activeDetailRecipeId) {
    const isFav = state.favorites.includes(state.activeDetailRecipeId);
    icon.innerHTML = ICONS.heart(isFav, 'w-4 h-4');
    icon.classList.toggle('text-rose-400', isFav);
    const btn = document.getElementById('btn-detail-fav');
    if (btn) btn.title = isFav ? 'Retirer des favoris' : 'Mettre en favori';
  }
}
function openRecipeDetail(recipeId) {
  updateDetailFavIcon();
  const recipe = state.recipes.find(r => r.id === recipeId);
  if (!recipe) return;

  state.activeDetailRecipeId = recipeId;
  updateDetailFavIcon();
  const modal = document.getElementById('recipe-detail-modal');

  const detailImg = document.getElementById('detail-recipe-image');
  detailImg.onerror = () => imgFallback(detailImg);
  detailImg.src = safeImg(recipe.image);
  document.getElementById('detail-recipe-title').textContent = recipe.title;
  document.getElementById('detail-recipe-tag').textContent = recipe.tag;
  document.getElementById('detail-recipe-time').textContent = `${recipe.timeMinutes} min`;
  document.getElementById('detail-recipe-season').textContent = recipe.season === 'automne' ? '🍁 Automne' : (recipe.season === 'hiver' ? '❄️ Hiver' : '✨ Toute saison');
  
  const budgetBadge = document.getElementById('detail-recipe-budget');
  if (recipe.isBudget) {
    budgetBadge.classList.remove('hidden');
  } else {
    budgetBadge.classList.add('hidden');
  }

  document.getElementById('detail-recipe-portions').textContent = `${state.portions} portion${state.portions > 1 ? 's' : ''}`;

  // Rendu des ingrédients par rayon Grand Frais
  const ratio = state.portions / (recipe.basePortions || 4);
  const ingsList = document.getElementById('detail-ingredients-list');
  ingsList.innerHTML = '';
  document.getElementById('detail-ingredients-count').textContent = `${recipe.ingredients.length} articles`;

  GRAND_FRAIS_RAYONS.forEach(rayon => {
    const itemsInRayon = recipe.ingredients.filter(i => i.rayon === rayon.id);
    if (itemsInRayon.length === 0) return;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'bg-slate-50 rounded-2xl p-3 border border-slate-100';

    groupDiv.innerHTML = `
      <div class="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
        <span>${rayon.icon}</span> <span>${rayon.name}</span>
      </div>
      <div class="space-y-1.5 divide-y divide-slate-100">
        ${itemsInRayon.map(ing => {
          const qty = (ing.quantity || 1) * ratio;
          const formatted = formatQuantityAndUnit(qty, ing.unit, ing.name);
          return `
            <div class="flex items-center justify-between text-xs pt-1.5">
              <span class="text-slate-800 font-medium">${esc(ing.name)}</span>
              <span class="font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">${formatted}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    ingsList.appendChild(groupDiv);
  });

  // Rendu des étapes résumées
  const stepsList = document.getElementById('detail-steps-list');
  stepsList.innerHTML = '';
  recipe.steps.forEach((step, idx) => {
    const stepRow = document.createElement('div');
    stepRow.className = 'flex gap-2.5 py-1.5';
    const instruction = typeof step === 'string' ? step : (step.instruction || '');
    stepRow.innerHTML = `
      <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">${idx + 1}</span>
      <p class="text-xs text-slate-700 leading-relaxed font-medium flex-1">${esc(instruction)}</p>
    `;
    stepsList.appendChild(stepRow);
  });

  // Actions spécifiques aux recettes créées maison (Modifier / Supprimer)
  const customActions = document.getElementById('detail-custom-actions');
  if (customActions) {
    if (recipe.id.startsWith('custom-')) {
      customActions.classList.remove('hidden');
    } else {
      customActions.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
}

// ==========================================
// MODAL SELECTION DE PLAT POUR UN JOUR
// ==========================================
function openSelectMealModal(day) {
  state.selectingDay = day;
  document.getElementById('modal-day-name').textContent = typeof day === 'number' ? `repas ${day + 1}` : day;
  const modalSelectPortions = document.getElementById('modal-select-meal-portions');
  if (modalSelectPortions) {
    modalSelectPortions.textContent = `${state.portions} portion${state.portions > 1 ? 's' : ''}`;
  }
  const list = document.getElementById('modal-meal-choices-list');
  list.innerHTML = '';

  // Bouton création rapide de recette maison pour ce jour
  const quickAddBtn = document.createElement('button');
  quickAddBtn.className = 'w-full py-2.5 px-3 bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 mb-2 active:scale-95 transition-all shadow-xs';
  quickAddBtn.innerHTML = '<span>➕</span> Créer une nouvelle recette maison';
  quickAddBtn.addEventListener('click', () => {
    document.getElementById('select-meal-modal').classList.add('hidden');
    openCustomRecipeModal();
  });
  list.appendChild(quickAddBtn);

  state.recipes.forEach(recipe => {
    const item = document.createElement('div');
    item.className = 'ios-card p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:border-brand-500 transition-all';
    item.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <img src="${esc(safeImg(recipe.image))}" alt="" loading="lazy" decoding="async" onerror="imgFallback(this)" class="img-soft w-12 h-12 rounded-xl object-cover flex-shrink-0">
        <div class="min-w-0">
          <h4 class="font-bold text-xs text-slate-800 truncate">${esc(recipe.title)}</h4>
          <span class="text-[11px] text-slate-400">⏱️ ${esc(recipe.timeMinutes)} min • ${esc(recipe.tag)}</span>
        </div>
      </div>
      <button class="bg-brand-50 text-brand-700 font-bold text-xs px-2.5 py-1.5 rounded-lg">Choisir</button>
    `;

    item.addEventListener('click', () => {
      state.plan[state.selectingDay] = recipe.id;
      saveToLocalStorage();
      document.getElementById('select-meal-modal').classList.add('hidden');
      renderPlanning();
      renderGroceries();
    });

    list.appendChild(item);
  });

  document.getElementById('select-meal-modal').classList.remove('hidden');
}

// ==========================================
// MODE CUISINE PAS-À-PAS (STYLE JOW)
// ==========================================
function startCookingMode(recipeId) {
  const recipe = state.recipes.find(r => r.id === recipeId);
  if (!recipe) return;

  // Si on change de recette, on remet le minuteur à zéro
  if (!state.cookingRecipe || state.cookingRecipe.id !== recipeId) {
    resetCookingTimer();
  }

  state.cookingRecipe = recipe;
  state.cookingStepIndex = 0;

  document.getElementById('cooking-recipe-title').textContent = recipe.title;
  document.getElementById('cooking-recipe-tag').textContent = recipe.tag;
  document.getElementById('cooking-recipe-time').textContent = `⏱️ ${recipe.timeMinutes} min`;
  document.getElementById('cooking-recipe-portions').textContent = `🥘 ${state.portions} portions`;

  renderCookingStep();
  document.getElementById('cooking-modal').classList.remove('hidden');

  // Demander le WakeLock (garder l'écran allumé)
  requestWakeLock();
}

function renderCookingStep() {
  const recipe = state.cookingRecipe;
  const stepIndex = state.cookingStepIndex;
  const step = recipe.steps[stepIndex];
  const totalSteps = recipe.steps.length;

  document.getElementById('cooking-step-indicator').textContent = `Étape ${stepIndex + 1} sur ${totalSteps}`;
  document.getElementById('cooking-step-text').textContent = typeof step === 'string' ? step : (step.instruction || '');

  // Ingrédients spécifiques à cette étape
  const ingBox = document.getElementById('cooking-step-ingredients-box');
  const ingList = document.getElementById('cooking-step-ingredients-list');
  ingList.innerHTML = '';

  if (step.ingredients && step.ingredients.length > 0) {
    ingBox.classList.remove('hidden');
    const ratio = (state.portions || 4) / (recipe.basePortions || 4);
    step.ingredients.forEach(ingName => {
      const badge = document.createElement('span');
      badge.className = 'text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg';
      // Cherche l'ingrédient correspondant dans la recette pour afficher la quantité
      const matched = (recipe.ingredients || []).find(i => {
        const iName = (i.name || '').toLowerCase();
        const sName = ingName.toLowerCase();
        return iName === sName
          || iName.includes(sName.split(' ')[0])
          || sName.includes(iName.split(' ')[0]);
      });
      if (matched && matched.quantity) {
        const qty = matched.quantity * ratio;
        const formatted = formatQuantityAndUnit(qty, matched.unit, matched.name);
        badge.textContent = `${formatted} — ${matched.name}`;
      } else {
        badge.textContent = ingName;
      }
      ingList.appendChild(badge);
    });
  } else {
    ingBox.classList.add('hidden');
  }

  // Minuteur intégré pour cette étape
  const timerContainer = document.getElementById('cooking-timer-container');
  if (step.timerMinutes) {
    timerContainer.classList.remove('hidden');
  } else {
    timerContainer.classList.add('hidden');
  }

  // Mettre à jour l'affichage du minuteur sans couper le compte à rebours
  updateCookingTimerUI();

  // Boutons Suivant / Précédent
  const prevBtn = document.getElementById('btn-cooking-prev');
  const nextBtn = document.getElementById('btn-cooking-next');

  prevBtn.disabled = stepIndex === 0;
  prevBtn.classList.toggle('opacity-50', stepIndex === 0);

  if (stepIndex === totalSteps - 1) {
    nextBtn.innerHTML = `<span>🎉 Bon appétit !</span>`;
    nextBtn.className = "flex-2 w-2/3 bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs active:scale-95";
  } else {
    nextBtn.innerHTML = `<span>Étape suivante</span> →`;
    nextBtn.className = "flex-2 w-2/3 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-2xl text-xs active:scale-95";
  }
}

// ==========================================
// GESTION DES MINUTEURS MULTIPLES & INDÉPENDANTS
// (Chaque étape ayant une durée possède son propre minuteur, qui continue
//  de tourner même en changeant d'étape ou en passant à une autre)
// ==========================================
function formatCookingTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getStepTimer(stepIndex) {
  if (!state.activeTimers) state.activeTimers = {};
  return state.activeTimers[stepIndex];
}

function initStepTimer(stepIndex, durationMinutes) {
  if (!state.activeTimers) state.activeTimers = {};
  if (!state.activeTimers[stepIndex]) {
    state.activeTimers[stepIndex] = {
      stepIndex: stepIndex,
      label: `Étape ${stepIndex + 1}`,
      totalSeconds: durationMinutes * 60,
      remainingSeconds: durationMinutes * 60,
      running: false,
      intervalId: null
    };
  }
  return state.activeTimers[stepIndex];
}

function toggleCookingTimer(targetStepIndex = null) {
  const stepIdx = targetStepIndex !== null ? targetStepIndex : state.cookingStepIndex;
  const currentStep = state.cookingRecipe?.steps[stepIdx];
  if (!currentStep || !currentStep.timerMinutes) return;

  const timer = initStepTimer(stepIdx, currentStep.timerMinutes);

  if (timer.running) {
    // Pause
    timer.running = false;
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
  } else {
    // Démarrer ou reprendre
    if (timer.remainingSeconds <= 0) {
      timer.remainingSeconds = timer.totalSeconds;
    }
    timer.running = true;
    timer.intervalId = setInterval(() => {
      if (timer.remainingSeconds > 0) {
        timer.remainingSeconds--;
        updateCookingTimerUI();
      } else {
        clearInterval(timer.intervalId);
        timer.intervalId = null;
        timer.running = false;
        playTimerSound();
        if ('vibrate' in navigator) {
          try { navigator.vibrate([400, 200, 400, 200, 800]); } catch (e) {}
        }
        showToast(`⏰ Minuteur terminé : ${timer.label}`, { duration: 9000 });
        updateCookingTimerUI();
      }
    }, 1000);
  }

  updateCookingTimerUI();
}

function resetCookingTimer(targetStepIndex = null) {
  const stepIdx = targetStepIndex !== null ? targetStepIndex : state.cookingStepIndex;
  const timer = getStepTimer(stepIdx);
  if (timer) {
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    timer.running = false;
    timer.remainingSeconds = timer.totalSeconds;
  }
  updateCookingTimerUI();
}

function resetAllCookingTimers() {
  if (state.activeTimers) {
    Object.values(state.activeTimers).forEach(t => {
      if (t.intervalId) {
        clearInterval(t.intervalId);
        t.intervalId = null;
      }
    });
  }
  state.activeTimers = {};
  updateCookingTimerUI();
}

function updateCookingTimerUI() {
  const currentStep = state.cookingRecipe?.steps[state.cookingStepIndex];
  const stepTimerBox = document.getElementById('cooking-timer-container');
  const stepTimerDisplay = document.getElementById('timer-display');
  const stepTimerToggle = document.getElementById('btn-timer-toggle');
  const stepTimerReset = document.getElementById('btn-timer-reset');

  // 1. Mise à jour du timer de l'étape courante
  if (currentStep && currentStep.timerMinutes) {
    if (stepTimerBox) stepTimerBox.classList.remove('hidden');
    const timer = getStepTimer(state.cookingStepIndex);
    const remaining = timer ? timer.remainingSeconds : currentStep.timerMinutes * 60;
    const isRunning = timer ? timer.running : false;

    if (stepTimerDisplay) stepTimerDisplay.textContent = formatCookingTime(remaining);
    if (stepTimerToggle) {
      stepTimerToggle.textContent = isRunning ? 'Pause' : (timer && timer.remainingSeconds < timer.totalSeconds ? 'Reprendre' : 'Démarrer');
      stepTimerToggle.className = isRunning
        ? "bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm active:scale-95"
        : "bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm active:scale-95";
    }
    if (stepTimerReset) {
      if (timer && timer.remainingSeconds < timer.totalSeconds) {
        stepTimerReset.classList.remove('hidden');
      } else {
        stepTimerReset.classList.add('hidden');
      }
    }
  } else {
    if (stepTimerBox) stepTimerBox.classList.add('hidden');
  }

  // 2. Bannière sticky en haut : affiche tous les minuteurs actifs ou en pause
  const stickyBanner = document.getElementById('sticky-cooking-timer-banner');
  if (stickyBanner) {
    const activeTimersList = Object.values(state.activeTimers || {}).filter(t => t.running || (t.remainingSeconds > 0 && t.remainingSeconds < t.totalSeconds));
    if (activeTimersList.length > 0) {
      stickyBanner.classList.remove('hidden');
      let timersContainer = stickyBanner.querySelector('.timers-list');
      if (!timersContainer) {
        timersContainer = document.createElement('div');
        timersContainer.className = 'timers-list px-4 py-2 flex flex-col gap-2';
        stickyBanner.appendChild(timersContainer);
      }
      timersContainer.innerHTML = '';

      activeTimersList.forEach(t => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-2 py-0.5 border-b border-emerald-700/50 last:border-0';
        row.innerHTML = `
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs">${t.running ? '⏳' : '⏸️'}</span>
            <span class="font-mono font-bold text-sm bg-emerald-900/90 px-2 py-0.5 rounded-md tracking-wider text-emerald-200">
              ${formatCookingTime(t.remainingSeconds)}
            </span>
            <span class="text-xs font-semibold truncate text-white">
              ${t.label} ${t.running ? '' : '(en pause)'}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button class="btn-sub-timer-toggle bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-[11px] px-2.5 py-1 rounded-lg active:scale-95 shadow-xs" data-step="${t.stepIndex}">
              ${t.running ? 'Pause' : 'Reprendre'}
            </button>
            <button class="btn-sub-timer-reset bg-emerald-700 hover:bg-emerald-900 text-white text-[11px] px-2 py-1 rounded-lg active:scale-95" data-step="${t.stepIndex}" title="Réinitialiser">
              ↺
            </button>
          </div>
        `;

        row.querySelector('.btn-sub-timer-toggle').addEventListener('click', () => {
          toggleCookingTimer(t.stepIndex);
        });
        row.querySelector('.btn-sub-timer-reset').addEventListener('click', () => {
          resetCookingTimer(t.stepIndex);
        });

        timersContainer.appendChild(row);
      });
    } else {
      stickyBanner.classList.add('hidden');
    }
  }
}

function playTimerSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Ré
    osc.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } catch (e) {
    console.log("Audio not allowed", e);
  }
}

// WakeLock API (garde l'écran iPhone allumé)
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
      document.getElementById('wake-lock-label').textContent = 'Écran actif';
    }
  } catch (err) {
    console.log('WakeLock non supporté ou refusé', err);
  }
}

function releaseWakeLock() {
  if (state.wakeLock) {
    state.wakeLock.release().then(() => state.wakeLock = null);
  }
}

// ==========================================
// EXPORTS & PARTAGE FAMILLE
// ==========================================

function getShareUrl() {
  const ids = (Array.isArray(state.plan) ? state.plan : Object.values(state.plan)).map(id => id || '').join(',');
  let url = `${window.location.origin}${window.location.pathname}?menu=${ids}&portions=${state.portions}`;
  if (state.householdCode) {
    url += `&household=${encodeURIComponent(state.householdCode)}`;
  }

  // Inclure les articles courants s'il y en a (œufs, lait, etc.)
  if (state.staples && state.staples.length > 0) {
    const minStaples = state.staples.map(s => ({ n: s.name, c: s.checked ? 1 : 0 }));
    url += `&staples=${encodeURIComponent(JSON.stringify(minStaples))}`;
  }

  return url;
}

function updateQRCode() {
  const shareUrl = getShareUrl();
  const qrImg = document.getElementById('share-qr-image');
  if (qrImg && qrImg.dataset.enabled === '1') {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}`;
  }
}

// 1. Lien Magique partagé
function shareMagicLink() {
  const shareUrl = getShareUrl();

  if (navigator.share) {
    navigator.share({
      title: "Notre menu de la semaine & Courses Grand Frais",
      text: `Voici nos repas (${state.portions} portions) et la liste de courses !`,
      url: shareUrl
    }).catch(() => copyToClipboard(shareUrl, 'Lien copié'));
  } else {
    copyToClipboard(shareUrl, 'Lien copié');
  }
}

// 2. Texte propre pour WhatsApp ou Notes Apple
function getFormattedGroceriesText() {
  const groceries = computeGroceries();
  let text = `🛒 *COURSES GRAND FRAIS* (${state.portions} portions)\n`;
  text += `📅 Semaine du ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}\n\n`;

  GRAND_FRAIS_RAYONS.forEach(rayon => {
    const isStaple = rayon.id === 'courants';
    const items = isStaple ? state.staples : groceries.filter(g => g.rayon === rayon.id);
    if (items.length === 0) return;

    text += `${rayon.icon} *${rayon.name.toUpperCase()}*\n`;
    items.forEach(item => {
      if (isStaple) {
        text += `[ ] ${item.name}\n`;
      } else {
        const qStr = item.formattedQtyText || formatQuantityAndUnit(item.quantity, item.baseUnit || item.unit);
        text += `[ ] ${qStr} - ${item.name}\n`;
      }
    });
    text += `\n`;
  });

  return text;
}

function copyFormattedText() {
  const text = getFormattedGroceriesText();
  copyToClipboard(text, 'Liste copiée : collez-la dans Notes ou WhatsApp');
}

function copyToClipboard(content, okMessage = 'Copié dans le presse-papier') {
  const manual = () => promptDialog({
    title: 'Copier manuellement',
    message: 'Sélectionnez le texte puis copiez-le.',
    value: content,
    multiline: true,
    confirmLabel: 'Fermer',
    hideCancel: true
  });
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(content).then(() => showToast(okMessage)).catch(manual);
  } else {
    manual();
  }
}

// ==========================================
// CONFIGURATION DES ÉCOUTEURS D'ÉVÉNEMENTS
// ==========================================
function switchTab(tabId) {
  const tab = document.getElementById(tabId);
  if (!tab) return;
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    b.classList.remove('active', 'text-brand-600', 'font-bold');
    b.classList.add('text-slate-400');
  });
  tab.classList.add('active');
  const btn = document.querySelector(`.nav-tab-btn[data-tab="${tabId}"]`);
  if (btn) {
    btn.classList.add('active', 'text-brand-600', 'font-bold');
    btn.classList.remove('text-slate-400');
  }
  window.scrollTo(0, 0);
  safeSetItem('gamelle_tab', tabId);
}

function setupEventListeners() {
  // Navigation par onglets
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => switchTab(e.currentTarget.dataset.tab));
  });

  // Apparence : Clair / Sombre / Système
  document.querySelectorAll('[data-theme-pref]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.gamelleTheme) window.gamelleTheme.set(btn.dataset.themePref);
      renderThemeControl();
    });
  });

  // Réglage des portions (+ / -) dans l'en-tête (pas de 1 portion, de 1 à 12)
  document.getElementById('btn-portion-minus').addEventListener('click', () => {
    if (state.portions > 1) {
      state.portions -= 1;
      saveToLocalStorage();
      renderAll();
    }
  });

  document.getElementById('btn-portion-plus').addEventListener('click', () => {
    if (state.portions < 12) {
      state.portions += 1;
      saveToLocalStorage();
      renderAll();
    }
  });

  // Réglage des portions (+ / -) directement dans la fiche détaillée d'un plat
  const btnDetailMinus = document.getElementById('btn-detail-portion-minus');
  if (btnDetailMinus) {
    btnDetailMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.portions > 1) {
        state.portions -= 1;
        saveToLocalStorage();
        renderAll();
      }
    });
  }

  const btnDetailPlus = document.getElementById('btn-detail-portion-plus');
  if (btnDetailPlus) {
    btnDetailPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.portions < 12) {
        state.portions += 1;
        saveToLocalStorage();
        renderAll();
      }
    });
  }

  // Générer & Effacer le planning
  document.getElementById('btn-generate-menu').addEventListener('click', () => {
    const snapshot = takeSnapshot();
    const hadMeals = state.plan.some(Boolean);
    generateBalancedWeek(false);
    if (hadMeals && takeSnapshot() !== snapshot) {
      showToast('Nouveau menu généré', { action: 'Annuler', onAction: () => restoreSnapshot(snapshot) });
    }
  });
  document.getElementById('btn-clear-menu').addEventListener('click', clearMenu);

  const saveMenuBtn = document.getElementById('btn-save-current-menu');
  if (saveMenuBtn) saveMenuBtn.addEventListener('click', saveCurrentMenu);

  const openSavedBtn = document.getElementById('btn-open-saved-menus');
  if (openSavedBtn) openSavedBtn.addEventListener('click', openSavedMenusModal);

  const closeSavedBtn = document.getElementById('btn-close-saved-menus');
  if (closeSavedBtn) closeSavedBtn.addEventListener('click', closeSavedMenusModal);

  // Copier & Vider les courses
  document.getElementById('btn-copy-groceries').addEventListener('click', copyFormattedText);
  document.getElementById('btn-clear-checked').addEventListener('click', () => {
    const anyChecked = Object.values(state.checkedGroceries).some(Boolean) || state.staples.some(s => s.checked);
    if (!anyChecked) { showToast('Aucun article coché'); return; }
    const snapshot = takeSnapshot();
    state.checkedGroceries = {};
    state.staples.forEach(s => s.checked = false);
    saveToLocalStorage();
    renderGroceries();
    showToast('Articles décochés', { action: 'Annuler', onAction: () => restoreSnapshot(snapshot) });
  });

  // Ajout de produits courants
  document.getElementById('form-add-staple').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('staple-input');
    const val = input.value.trim();
    if (val) {
      state.staples.push({
        id: 'staple_' + Date.now(),
        name: val,
        checked: false
      });
      input.value = '';
      saveToLocalStorage();
      renderGroceries();
    }
  });

  document.querySelectorAll('.staple-quick-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const name = e.currentTarget.dataset.name;
      if (!state.staples.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        state.staples.push({
          id: 'staple_' + Date.now(),
          name: name,
          checked: false
        });
        saveToLocalStorage();
        renderGroceries();
      }
    });
  });

  // Recherche & Filtres dans le catalogue
  let searchTimer = null;
  document.getElementById('recipe-search-input').addEventListener('input', (e) => {
    const value = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = value;
      renderCatalog(true);
    }, 160);
  });
  setupCatalogEvents();
  setupQrOptIn();

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active', 'bg-brand-600', 'text-white');
        b.classList.add('bg-white', 'text-slate-600');
      });
      e.currentTarget.classList.add('active', 'bg-brand-600', 'text-white');
      e.currentTarget.classList.remove('bg-white', 'text-slate-600');
      state.activeFilter = e.currentTarget.dataset.filter;
      renderCatalog(true);
    });
  });

  // Tri du catalogue
  const sortSelect = document.getElementById('recipe-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortOption = e.target.value;
      renderCatalog(true);
    });
  }

  // Fiche Recette Détaillée (Modal Ingrédients)
  const btnDetailFav = document.getElementById('btn-detail-fav');
  if (btnDetailFav) {
    btnDetailFav.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.activeDetailRecipeId) return;
      toggleFavorite(state.activeDetailRecipeId);
      updateDetailFavIcon();
      renderCatalog();
    });
  }

  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('recipe-detail-modal').classList.add('hidden');
  });

  document.getElementById('btn-detail-add-to-plan').addEventListener('click', () => {
    if (state.activeDetailRecipeId) {
      document.getElementById('recipe-detail-modal').classList.add('hidden');
      addRecipeToPlan(state.activeDetailRecipeId);
    }
  });

  document.getElementById('btn-detail-cook').addEventListener('click', () => {
    if (state.activeDetailRecipeId) {
      document.getElementById('recipe-detail-modal').classList.add('hidden');
      startCookingMode(state.activeDetailRecipeId);
    }
  });

  // Mode Cuisine
  document.getElementById('btn-close-cooking').addEventListener('click', () => {
    document.getElementById('cooking-modal').classList.add('hidden');
    resetCookingTimer();
    releaseWakeLock();
  });

  // Navigation dans les étapes : conserve le minuteur en arrière-plan sans le remettre à zéro !
  document.getElementById('btn-cooking-prev').addEventListener('click', () => {
    if (state.cookingStepIndex > 0) {
      state.cookingStepIndex--;
      renderCookingStep();
    }
  });

  document.getElementById('btn-cooking-next').addEventListener('click', () => {
    const total = state.cookingRecipe.steps.length;
    if (state.cookingStepIndex < total - 1) {
      state.cookingStepIndex++;
      renderCookingStep();
    } else {
      document.getElementById('cooking-modal').classList.add('hidden');
      resetAllCookingTimers();
      releaseWakeLock();
    }
  });

  // Contrôles du minuteur (dans l'étape)
  const timerToggleBtn = document.getElementById('btn-timer-toggle');
  if (timerToggleBtn) {
    timerToggleBtn.addEventListener('click', () => toggleCookingTimer());
  }
  const timerResetBtn = document.getElementById('btn-timer-reset');
  if (timerResetBtn) {
    timerResetBtn.addEventListener('click', () => resetCookingTimer());
  }

  // Modals Fermetures
  document.getElementById('btn-close-select-meal').addEventListener('click', () => {
    document.getElementById('select-meal-modal').classList.add('hidden');
  });

  // Partage
  document.getElementById('btn-share-magic-link').addEventListener('click', shareMagicLink);
  document.getElementById('btn-share-whatsapp-text').addEventListener('click', copyFormattedText);

  // Exporter JSON
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "gamelle_panier_sauvegarde.json");
    dlAnchorElem.click();
  });

  // Gestion du Studio de Recette Maison
  const btnOpenAddRecipe = document.getElementById('btn-open-add-recipe');
  if (btnOpenAddRecipe) {
    btnOpenAddRecipe.addEventListener('click', () => openCustomRecipeModal());
  }

  const btnPlanningAddRecipe = document.getElementById('btn-planning-add-recipe');
  if (btnPlanningAddRecipe) {
    btnPlanningAddRecipe.addEventListener('click', () => openCustomRecipeModal());
  }

  document.getElementById('btn-close-custom-recipe').addEventListener('click', () => {
    document.getElementById('custom-recipe-modal').classList.add('hidden');
  });

  // Boutons photos prédéfinies
  document.querySelectorAll('.preset-photo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.currentTarget.dataset.img;
      const preview = document.getElementById('custom-image-preview');
      const urlInput = document.getElementById('custom-image-url');
      if (preview) preview.src = url;
      if (urlInput) urlInput.value = url;
    });
  });

  const customImgInput = document.getElementById('custom-image-url');
  if (customImgInput) {
    customImgInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const preview = document.getElementById('custom-image-preview');
      if (preview && val) preview.src = val;
    });
  }

  // Modifier une recette maison existante depuis la fiche détail
  const btnEditCustom = document.getElementById('btn-edit-custom-recipe');
  if (btnEditCustom) {
    btnEditCustom.addEventListener('click', () => {
      const recipe = state.recipes.find(r => r.id === state.activeDetailRecipeId);
      if (recipe) {
        document.getElementById('recipe-detail-modal').classList.add('hidden');
        openCustomRecipeModal(recipe);
      }
    });
  }

  // Supprimer une recette maison
  const btnDeleteCustom = document.getElementById('btn-delete-custom-recipe');
  if (btnDeleteCustom) {
    btnDeleteCustom.addEventListener('click', async () => {
      const recipe = state.recipes.find(r => r.id === state.activeDetailRecipeId);
      if (!recipe) return;
      const ok = await confirmDialog({
        title: 'Supprimer cette recette ?',
        message: `« ${recipe.title} » sera définitivement retirée de votre catalogue.`,
        confirmLabel: 'Supprimer',
        danger: true
      });
      if (ok) deleteCustomRecipe(recipe.id);
    });
  }

  // Soumission du formulaire de recette maison
  document.getElementById('form-custom-recipe').addEventListener('submit', (e) => {
    e.preventDefault();
    const existingId = document.getElementById('custom-recipe-id').value.trim();
    const title = document.getElementById('custom-title').value.trim();
    const time = parseInt(document.getElementById('custom-time').value, 10) || 25;
    const type = document.getElementById('custom-type').value;
    const season = document.getElementById('custom-season').value;
    const isBudget = document.getElementById('custom-budget').checked;
    const imgUrl = document.getElementById('custom-image-url').value.trim() || document.getElementById('custom-image-preview').src;
    const ingRaw = document.getElementById('custom-ingredients-text').value.trim();
    const stepsRaw = document.getElementById('custom-steps-text').value.trim();

    // Parser les ingrédients avec notre normaliseur expert Grand Frais
    const parsedIngs = ingRaw.split('\n').map(l => l.trim()).filter(Boolean).map(parseCustomIngredientLine);

    // Parser les étapes avec détection automatique des minuteurs
    const parsedSteps = stepsRaw.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const instruction = line.replace(/^[0-9]+[.)]\s*/, '').trim();
      let timerMinutes = null;
      const m = instruction.match(/(\d+)\s*(?:minutes?|min)\b/i);
      if (m) timerMinutes = parseInt(m[1], 10);
      return {
        instruction,
        ingredients: [],
        timerMinutes
      };
    });

    const targetId = existingId || ('custom-' + Date.now());
    const recipeObj = {
      id: targetId,
      title,
      description: "Recette maison personnalisée",
      season: season || "toutes",
      timeMinutes: time,
      tag: "Recette Maison",
      type: type,
      isBudget: isBudget,
      basePortions: 4,
      image: imgUrl,
      ingredients: parsedIngs,
      steps: parsedSteps
    };

    // Mettre à jour state.recipes
    const existingIdx = state.recipes.findIndex(r => r.id === targetId);
    if (existingIdx !== -1) {
      state.recipes[existingIdx] = recipeObj;
    } else {
      state.recipes.push(recipeObj);
    }

    saveToLocalStorage();
    document.getElementById('custom-recipe-modal').classList.add('hidden');
    document.getElementById('form-custom-recipe').reset();
    renderCatalog();
    renderPlanning();
    renderGroceries();
    showSyncToast(existingId ? '✏️ Recette modifiée & synchronisée !' : '✨ Recette ajoutée au catalogue & synchronisée !');
  });

  // Boutons du Foyer Partagé en Direct
  const btnJoinHousehold = document.getElementById('btn-join-household');
  if (btnJoinHousehold) {
    btnJoinHousehold.addEventListener('click', () => {
      const input = document.getElementById('input-household-code');
      const value = input ? input.value.trim() : '';
      if (!value) { showToast('Saisissez le code de votre foyer'); return; }
      attemptJoinHousehold(value);
    });
  }

  const btnGenCode = document.getElementById('btn-generate-household-code');
  if (btnGenCode) {
    btnGenCode.addEventListener('click', () => {
      const code = generateHouseholdCode();
      const input = document.getElementById('input-household-code');
      if (input) input.value = code;
      setHouseholdCode(code);
    });
  }

  const btnDisconnect = document.getElementById('btn-disconnect-household');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Quitter le foyer ?',
        message: 'La synchronisation s\'arrête. Vos données restent sur ce téléphone.',
        confirmLabel: 'Quitter',
        danger: true
      });
      if (ok) disconnectHousehold();
    });
  }

  const btnCopyCode = document.getElementById('btn-copy-sync-code');
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      if (state.householdCode && navigator.clipboard) {
        navigator.clipboard.writeText(state.householdCode).then(() => {
          showToast('Code du foyer copié');
        });
      }
    });
  }

  const btnForceSync = document.getElementById('btn-force-sync');
  if (btnForceSync) {
    btnForceSync.addEventListener('click', () => {
      broadcastSync();
      pollLatestSync();
      showSyncToast('🔄 Synchronisation forcée effectuée !');
    });
  }

  const headerSyncPill = document.getElementById('header-sync-pill');
  if (headerSyncPill) {
    headerSyncPill.addEventListener('click', () => {
      // Basculer vers l'onglet Partager
      switchTab('tab-partager');
    });
  }
}

let swRegistration = null;
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    swRegistration = reg;
    const announce = (worker) => {
      showToast('Nouvelle version disponible', {
        action: 'Mettre à jour',
        duration: 15000,
        onAction: () => { worker.postMessage({ type: 'SKIP_WAITING' }); }
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) announce(w);
      });
    });
  }).catch(err => console.log('SW registration failed:', err));

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

function checkForAppUpdate() {
  if (swRegistration) swRegistration.update().catch(() => {});
}

function setupQrOptIn() {
  const btn = document.getElementById('btn-show-qr');
  const img = document.getElementById('share-qr-image');
  const box = document.getElementById('share-qr-box');
  if (!btn || !img || !box) return;
  btn.addEventListener('click', () => {
    img.dataset.enabled = '1';
    box.classList.remove('hidden');
    btn.classList.add('hidden');
    updateQRCode();
  });
}

// Lancement au chargement du DOM
document.addEventListener('DOMContentLoaded', init);


// ==========================================
// STUDIO RECETTES MAISON (OUVERTURE & SUPPRESSION)
// ==========================================

function openCustomRecipeModal(recipeToEdit = null) {
  const modal = document.getElementById('custom-recipe-modal');
  const form = document.getElementById('form-custom-recipe');
  const idInput = document.getElementById('custom-recipe-id');
  const titleInput = document.getElementById('custom-title');
  const timeInput = document.getElementById('custom-time');
  const typeInput = document.getElementById('custom-type');
  const seasonInput = document.getElementById('custom-season');
  const budgetInput = document.getElementById('custom-budget');
  const imgInput = document.getElementById('custom-image-url');
  const previewImg = document.getElementById('custom-image-preview');
  const ingsText = document.getElementById('custom-ingredients-text');
  const stepsText = document.getElementById('custom-steps-text');
  const submitLabel = document.getElementById('custom-submit-label');

  if (recipeToEdit) {
    idInput.value = recipeToEdit.id;
    titleInput.value = recipeToEdit.title || '';
    timeInput.value = recipeToEdit.timeMinutes || 25;
    typeInput.value = recipeToEdit.type || 'volaille';
    seasonInput.value = recipeToEdit.season || 'toutes';
    budgetInput.checked = recipeToEdit.isBudget !== false;
    imgInput.value = recipeToEdit.image || '';
    previewImg.src = recipeToEdit.image || 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80';

    ingsText.value = (recipeToEdit.ingredients || []).map(i => {
      return `${i.quantity || 1} ${i.unit || ''} ${i.name}`.replace(/\s+/g, ' ').trim();
    }).join('\n');

    stepsText.value = (recipeToEdit.steps || []).map((s, idx) => {
      const text = typeof s === 'string' ? s : (s.instruction || '');
      return `${idx + 1}. ${text}`;
    }).join('\n');

    if (submitLabel) submitLabel.textContent = 'Enregistrer les modifications';
  } else {
    form.reset();
    idInput.value = '';
    previewImg.src = 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop&q=80';
    imgInput.value = '';
    if (submitLabel) submitLabel.textContent = 'Enregistrer dans mon catalogue';
  }

  modal.classList.remove('hidden');
}

// Lecture d'une ligne d'ingrédient saisie à la main :
// « 600g patate douce », « 2 grosses pièces de patate douce », « 1 c. à soupe d'huile d'olive »,
// « 1,5 kg de pommes de terre », « 3 oignons »…
function parseCustomIngredientLine(line) {
  const UNIT_PATTERN = '(?:kg|g|gr|grammes?|ml|cl|l|litres?|' +
    'c\\.?\\s*à\\s*s(?:oupe)?\\.?|c\\.?\\s*à\\s*c(?:afé)?\\.?|c\\.?\\s*a\\s*soupe|c\\.?\\s*a\\s*cafe|cuill[eè]res?\\s+à\\s+(?:soupe|café)|cs|cc|cas|cac|' +
    '(?:grosses?|petites?|moyennes?)\\s+pi[eè]ces?|pi[eè]ces?|unités?|gousses?|bottes?|bouquets?|brins?|tiges?|branches?|' +
    'tranches?|pav[eé]s?|sachets?|bo[iî]tes?|cubes?|pincées?|pincees?|poignées?|poignees?|pots?|paquets?|t[eê]tes?|cm|morceaux?)';
  const re = new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*(?:(' + UNIT_PATTERN + ')(?=\\s|$)\\s*)?(.*)$', 'i');

  let quantity = 1;
  let unit = 'piece';
  let rawName = line;
  const m = line.match(re);
  if (m) {
    quantity = parseFloat(m[1].replace(',', '.')) || 1;
    if (m[2]) unit = canonicalUnit(m[2]);
    rawName = (m[3] || '').trim();
  }
  // « de patate douce », « d'huile » → « patate douce », « huile »
  rawName = rawName.replace(/^(de|des|du)\s+/i, '').replace(/^d['’]\s*/i, '').trim() || line;

  const norm = normalizeIngredient({ name: rawName, quantity, unit, rayon: 'epicerie' });
  return {
    name: norm.name || rawName,
    quantity,
    unit,               // unité d'origine conservée : la conversion se fait dans la liste de courses
    rayon: norm.rayon || 'epicerie'
  };
}

function deleteCustomRecipe(recipeId) {
  state.recipes = state.recipes.filter(r => r.id !== recipeId);
  const keptLocked = [];
  const newPlan = [];
  state.plan.forEach((id, idx) => {
    if (id === recipeId) return;
    if ((state.lockedSlots || []).includes(idx)) keptLocked.push(newPlan.length);
    newPlan.push(id);
  });
  state.plan = newPlan;
  state.lockedSlots = keptLocked;

  const savedCustom = safeGetItem('gamelle_custom_recipes');
  if (savedCustom) {
    const list = JSON.parse(savedCustom).filter(r => r.id !== recipeId);
    safeSetItem('gamelle_custom_recipes', JSON.stringify(list));
  }

  saveToLocalStorage();
  document.getElementById('recipe-detail-modal').classList.add('hidden');
  renderAll();
  showSyncToast('🗑️ Recette supprimée de votre catalogue');
}

// ==========================================
// MOTEUR DE SYNCHRONISATION FOYER EN DIRECT
// ==========================================

function getHouseholdTopic() {
  if (!state.householdCode) return null;
  return `gamelle_foyer_${state.householdCode.trim().toUpperCase()}`;
}

async function attemptJoinHousehold(raw) {
  const code = cleanStr(raw, 60).toUpperCase();
  if (isWeakHouseholdCode(code)) {
    const ok = await confirmDialog({
      title: 'Code facile à deviner',
      message: 'Ce code est court : quelqu\'un pourrait le deviner et voir votre menu. Utilisez « Générer un code sécurisé » pour un code unique.',
      confirmLabel: 'Utiliser quand même'
    });
    if (!ok) return;
  }
  setHouseholdCode(code);
}

function setHouseholdCode(code) {
  const clean = cleanStr(code || '', 60).toUpperCase();
  if (!clean) return;

  state.householdCode = clean;
  safeSetItem('gamelle_household_code', clean);
  updateSyncStatusUI();
  initHouseholdSync();
  broadcastSync();
  showToast('Foyer connecté : synchronisation en direct');
}

function disconnectHousehold() {
  if (state.syncEventSource) {
    try { state.syncEventSource.close(); } catch(e) {}
    state.syncEventSource = null;
  }
  state.householdCode = '';
  safeRemoveItem('gamelle_household_code');
  updateSyncStatusUI();
  showSyncToast('Déconnecté du foyer');
}

function updateSyncStatusUI() {
  const syncBadge = document.getElementById('sync-status-badge');
  const setupBox = document.getElementById('sync-setup-box');
  const activeBox = document.getElementById('sync-active-box');
  const codeLabel = document.getElementById('active-household-code-label');
  const headerPill = document.getElementById('header-sync-pill');
  const headerLabel = document.getElementById('header-sync-label');

  if (state.householdCode) {
    if (syncBadge) {
      syncBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5 flex-shrink-0';
      syncBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> En direct';
    }
    if (setupBox) setupBox.classList.add('hidden');
    if (activeBox) activeBox.classList.remove('hidden');
    if (codeLabel) codeLabel.textContent = state.householdCode;
    if (headerPill) {
      headerPill.classList.remove('hidden');
      headerPill.classList.add('flex');
    }
    if (headerLabel) headerLabel.textContent = state.householdCode;
  } else {
    if (syncBadge) {
      syncBadge.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 flex items-center gap-1.5 flex-shrink-0';
      syncBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-400"></span> Inactif';
    }
    if (setupBox) setupBox.classList.remove('hidden');
    if (activeBox) activeBox.classList.add('hidden');
    if (headerPill) {
      headerPill.classList.add('hidden');
      headerPill.classList.remove('flex');
    }
  }
}

function initHouseholdSync() {
  const topic = getHouseholdTopic();
  if (!topic) return;

  if (state.syncEventSource) {
    try { state.syncEventSource.close(); } catch(e) {}
    state.syncEventSource = null;
  }

  // 1. Écouteur temps réel via Server-Sent Events (SSE)
  if (typeof EventSource !== 'undefined') {
    try {
      const sseUrl = `https://ntfy.sh/${topic}/sse`;
      state.syncEventSource = new EventSource(sseUrl);

      state.syncEventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.event === 'message') {
            readNtfyPayload(raw).then(payload => { if (payload) handleIncomingSync(payload); });
          }
        } catch (err) {
          console.warn('Sync parse error:', err);
        }
      };
    } catch(e) {
      console.warn('EventSource error:', e);
    }
  }

  // 2. Récupérer l'état actuel
  pollLatestSync();
}

function pollLatestSync() {
  const topic = getHouseholdTopic();
  if (!topic || typeof fetch === 'undefined') return;

  fetch(`https://ntfy.sh/${topic}/json?poll=1`)
    .then(res => res.text())
    .then(async text => {
      const lines = text.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.event && entry.event !== 'message') continue;
          const payload = await readNtfyPayload(entry);
          if (!payload) continue;
          // Seul le message le plus récent compte : on s'arrête dès qu'on l'a examiné
          handleIncomingSync(payload);
          break;
        } catch(e) {}
      }
    })
    .catch(err => console.warn('Erreur poll synchro:', err));
}

// ntfy.sh transforme automatiquement les messages de plus de 4 Ko en pièce jointe :
// on lit alors le JSON depuis l'URL de la pièce jointe.
function readNtfyPayload(entry) {
  try {
    if (entry.attachment && entry.attachment.url) {
      return fetch(entry.attachment.url).then(r => r.json()).catch(() => null);
    }
    if (entry.message) return Promise.resolve(JSON.parse(entry.message));
  } catch (e) {}
  return Promise.resolve(null);
}

function handleIncomingSync(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.timestamp !== 'number' || !isFinite(payload.timestamp)) return false;

  // Ignorer nos propres messages
  if (payload.senderId && payload.senderId === state.deviceId) return false;

  // Ignorer si ce message est plus ancien que notre dernière synchro
  if (payload.timestamp <= (state.lastSyncTimestamp || 0)) return false;

  state.lastSyncTimestamp = payload.timestamp;
  safeSetItem('gamelle_last_sync', payload.timestamp);

  // Appliquer les données reçues (toutes validées : un message ne peut pas injecter de code)
  if (Array.isArray(payload.plan)) state.plan = sanitizePlan(payload.plan);
  if (payload.portions) state.portions = Math.round(cleanNum(payload.portions, 1, 12, state.portions));
  if (Array.isArray(payload.lockedSlots)) state.lockedSlots = sanitizeSlots(payload.lockedSlots);
  if (Array.isArray(payload.staples)) state.staples = sanitizeStaples(payload.staples);
  if (payload.checkedGroceries && typeof payload.checkedGroceries === 'object') state.checkedGroceries = sanitizeChecked(payload.checkedGroceries);
  if (Array.isArray(payload.savedMenus)) state.savedMenus = sanitizeSavedMenus(payload.savedMenus);
  if (Array.isArray(payload.favorites)) state.favorites = sanitizeStringList(payload.favorites);

  // Synchronisation des recettes personnalisées
  if (Array.isArray(payload.customRecipes)) {
    const custom = sanitizeRecipeList(payload.customRecipes);
    safeSetItem('gamelle_custom_recipes', JSON.stringify(custom));
    state.recipes = [...DEFAULT_RECIPES, ...custom];
  }

  // Sauvegarder localement sans re-diffuser
  safeSetItem('gamelle_portions', state.portions);
  safeSetItem('gamelle_plan', JSON.stringify(state.plan));
  safeSetItem('gamelle_saved_menus', JSON.stringify(state.savedMenus));
  safeSetItem('gamelle_staples', JSON.stringify(state.staples));
  safeSetItem('gamelle_checked', JSON.stringify(state.checkedGroceries));
  safeSetItem('gamelle_locked_slots', JSON.stringify(state.lockedSlots || []));
  safeSetItem('gamelle_favorites', JSON.stringify(state.favorites || []));

  renderAll();
  showToast('Synchronisé avec votre foyer');
  return true;
}

function broadcastSync() {
  const topic = getHouseholdTopic();
  if (!topic || typeof fetch === 'undefined') return;

  clearTimeout(state.syncDebounceTimer);
  state.syncDebounceTimer = setTimeout(() => {
    const customList = (state.recipes || []).filter(r => r.id.startsWith('custom-'));
    const payload = {
      version: 2,
      timestamp: Date.now(),
      senderId: state.deviceId,
      portions: state.portions,
      plan: state.plan,
      lockedSlots: state.lockedSlots || [],
      staples: state.staples || [],
      checkedGroceries: state.checkedGroceries || {},
      customRecipes: customList,
      savedMenus: state.savedMenus || [],
      favorites: state.favorites || []
    };

    fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Title': 'Gamelle Sync',
        'Tags': 'arrows_counterclockwise'
      },
      body: JSON.stringify(payload)
    }).then(res => {
      if (res.ok) {
        state.lastSyncTimestamp = payload.timestamp;
        safeSetItem('gamelle_last_sync', payload.timestamp);
      }
    }).catch(err => console.warn('Broadcast error:', err));
  }, 400);
}
