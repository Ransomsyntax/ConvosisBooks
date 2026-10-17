// CONVOSIS — Appearance Engine
// macOS-style wallpapers, glassmorphism tuning, accent colours and light / dark / auto mode.
// Everything is applied through CSS variables (see css/glass.css) so changes are live.

(function () {
  'use strict';

  const KEY = 'convosis_appearance_v1';
  const WP_KEY = 'convosis_wallpaper_custom_v1';

  /* ------------------------------------------------------------------ data */
  const WALLPAPERS = [
    { id: 'bigsur',   name: 'Big Sur',   css: 'radial-gradient(55% 60% at 20% 15%, #ff9a9e 0%, transparent 65%), radial-gradient(60% 60% at 85% 25%, #a18cd1 0%, transparent 65%), radial-gradient(70% 70% at 55% 105%, #5b86e5 0%, transparent 70%), linear-gradient(135deg, #fbc2eb, #8ec5fc)' },
    { id: 'monterey', name: 'Monterey',  css: 'radial-gradient(60% 60% at 80% 10%, #f093fb 0%, transparent 60%), radial-gradient(70% 70% at 10% 90%, #4facfe 0%, transparent 65%), radial-gradient(50% 50% at 50% 50%, #7f5af0 0%, transparent 70%), linear-gradient(160deg, #2b1055, #7597de)' },
    { id: 'ventura',  name: 'Ventura',   css: 'radial-gradient(55% 55% at 15% 20%, #ffd86f 0%, transparent 60%), radial-gradient(60% 60% at 90% 35%, #fc6262 0%, transparent 62%), radial-gradient(70% 70% at 40% 110%, #6a3093 0%, transparent 70%), linear-gradient(135deg, #ff9966, #a044ff)' },
    { id: 'sonoma',   name: 'Sonoma',    css: 'radial-gradient(55% 55% at 20% 15%, #f9f586 0%, transparent 60%), radial-gradient(60% 60% at 85% 30%, #84fab0 0%, transparent 62%), radial-gradient(75% 75% at 50% 110%, #2b8a6e 0%, transparent 70%), linear-gradient(150deg, #d4fc79, #96e6a1)' },
    { id: 'sequoia',  name: 'Sequoia',   css: 'radial-gradient(60% 60% at 80% 15%, #3a7bd5 0%, transparent 62%), radial-gradient(70% 70% at 15% 95%, #11998e 0%, transparent 65%), linear-gradient(160deg, #0f2027, #203a43 55%, #2c5364)' },
    { id: 'aurora',   name: 'Aurora',    css: 'radial-gradient(60% 50% at 25% 20%, #00f5a0 0%, transparent 60%), radial-gradient(55% 55% at 80% 30%, #a855f7 0%, transparent 62%), radial-gradient(70% 60% at 50% 105%, #0ea5e9 0%, transparent 65%), linear-gradient(180deg, #05060f, #0b1b2e)' },
    { id: 'sunset',   name: 'Sunset',    css: 'radial-gradient(60% 60% at 50% 0%, #ffd194 0%, transparent 60%), radial-gradient(70% 70% at 90% 60%, #f857a6 0%, transparent 62%), radial-gradient(70% 70% at 10% 90%, #ff5858 0%, transparent 65%), linear-gradient(180deg, #fe8c00, #f83600)' },
    { id: 'ocean',    name: 'Ocean',     css: 'radial-gradient(60% 60% at 20% 10%, #a1ffce 0%, transparent 60%), radial-gradient(70% 70% at 85% 80%, #2193b0 0%, transparent 65%), linear-gradient(160deg, #6dd5ed, #2193b0)' },
    { id: 'lavender', name: 'Lavender',  css: 'radial-gradient(60% 60% at 20% 20%, #ffecd2 0%, transparent 60%), radial-gradient(60% 60% at 85% 70%, #fcb69f 0%, transparent 62%), linear-gradient(135deg, #e0c3fc, #8ec5fc)' },
    { id: 'mist',     name: 'Mist',      css: 'radial-gradient(60% 60% at 15% 10%, #ffffff 0%, transparent 60%), radial-gradient(60% 60% at 90% 90%, #cbd5e1 0%, transparent 65%), linear-gradient(160deg, #e2e8f0, #cbd5e1)' },
    { id: 'graphite', name: 'Graphite',  css: 'radial-gradient(60% 60% at 20% 15%, #6b7280 0%, transparent 60%), radial-gradient(70% 70% at 85% 85%, #374151 0%, transparent 65%), linear-gradient(160deg, #1f2937, #111827)' },
    { id: 'midnight', name: 'Midnight',  css: 'radial-gradient(60% 60% at 75% 15%, #4c1d95 0%, transparent 60%), radial-gradient(70% 70% at 15% 90%, #1e3a8a 0%, transparent 65%), linear-gradient(170deg, #020617, #0f172a)' }
  ];

  // k = how much to darken the accent for text on light glass
  const ACCENTS = [
    { id: 'convosis', name: 'Convosis Cyan', base: '#0284c7', k: 0.1 },
    { id: 'blue',     name: 'Classic Blue',  base: '#0a84ff', k: 0.3 },
    { id: 'purple',   name: 'Deep Purple',   base: '#bf5af2', k: 0.3 },
    { id: 'pink',     name: 'Neon Pink',     base: '#ff375f', k: 0.3 },
    { id: 'red',      name: 'Coral Red',     base: '#ff453a', k: 0.3 },
    { id: 'orange',   name: 'Warm Orange',   base: '#ff9f0a', k: 0.5, on: '#2b1b00' },
    { id: 'yellow',   name: 'Amber Yellow',  base: '#ffd60a', k: 0.6, on: '#2b2300' },
    { id: 'green',    name: 'Emerald Green', base: '#30d158', k: 0.45, on: '#06240f' },
    { id: 'graphite', name: 'Sleek Slate',   base: '#8e8e93', k: 0.4 }
  ];

  const GLASS_PRESETS = {
    clear:   { name: 'Clear',   glassBlur: 16, glassOpacity: 36, glassSat: 160 },
    frosted: { name: 'Frosted', glassBlur: 28, glassOpacity: 62, glassSat: 180 },
    ultra:   { name: 'Ultra',   glassBlur: 46, glassOpacity: 48, glassSat: 210 },
    solid:   { name: 'Solid',   glassBlur: 0,  glassOpacity: 96, glassSat: 100 }
  };

  const DEFAULTS = {
    mode: 'light',          // light | dark | auto
    accent: 'convosis',
    wallpaper: 'bigsur',    // id | custom | none
    wpBlur: 0,              // px
    wpDim: 0,               // %
    animate: true,
    glassPreset: 'frosted', // preset id | custom
    glassBlur: 28,
    glassOpacity: 62,
    glassSat: 180,
    sidebarHidden: false
  };

  /* --------------------------------------------------------------- helpers */
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const toast = (m) => {
    if (window.toast) window.toast(m);
    else if (window.ConvosisApp && ConvosisApp.showToast) ConvosisApp.showToast(m);
  };

  /* ---------------------------------------------------------------- engine */
  const ThemeEngine = {
    state: Object.assign({}, DEFAULTS),
    custom: null,          // { src, name }
    _ready: false,
    _wpKey: null,
    _wpIdx: 0,
    _saveTimer: null,

    /* ---- lifecycle ---- */
    init() {
      if (this._ready) return;
      this._ready = true;
      this.load();
      this.ensureDom();
      this.apply(true);

      if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => { if (this.state.mode === 'auto') this.apply(); };
        mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
      }
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeDrawer();
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          const s = document.getElementById('q') || document.getElementById('globalSearchInput');
          if (s) { e.preventDefault(); s.focus(); }
        }
      });
    },

    load() {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* ignore */ }
      if (saved) {
        this.state = Object.assign({}, DEFAULTS, saved);
      } else {
        // First run: check stored dark theme preference
        const legacy = window.convosisStore && window.convosisStore.state && window.convosisStore.state.themeMode;
        this.state = Object.assign({}, DEFAULTS, legacy === 'dark' ? { mode: 'dark' } : {});
      }
      try { this.custom = JSON.parse(localStorage.getItem(WP_KEY) || 'null'); } catch (e) { this.custom = null; }
      if (this.state.wallpaper === 'custom' && !this.custom) this.state.wallpaper = DEFAULTS.wallpaper;
    },

    save() {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
      }, 150);
    },

    ensureDom() {
      if (!document.getElementById('wallpaper')) {
        const wp = document.createElement('div');
        wp.id = 'wallpaper';
        wp.className = 'wallpaper';
        wp.setAttribute('aria-hidden', 'true');
        wp.innerHTML = '<div class="wp-image"></div><div class="wp-image"></div><div class="wp-dim"></div>';
        document.body.insertBefore(wp, document.body.firstChild);
      }
      if (!document.getElementById('appearanceDrawer')) {
        const d = document.createElement('aside');
        d.id = 'appearanceDrawer';
        d.className = 'ap-drawer';
        d.setAttribute('aria-label', 'Appearance & Glass Settings');
        d.innerHTML = `
          <div class="ap-drawer-head">
            <div class="ap-drawer-title-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7H16c3.3 0 6-2.7 6-6 0-4.9-4.5-8.4-10-8.4z"/></svg>
              <h3>Glass & Appearance</h3>
            </div>
            <button class="btn btn-secondary btn-sm btn-icon-only" onclick="ThemeEngine.closeDrawer()" title="Close (Esc)">✕</button>
          </div>
          <div class="ap-drawer-body"><div class="ap-root"></div></div>`;
        document.body.appendChild(d);
      }
    },

    /* ---- state helpers ---- */
    resolvedMode() {
      const m = this.state.mode;
      if (m === 'auto') return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      return m === 'dark' ? 'dark' : 'light';
    },

    toggleMode() {
      const cur = this.resolvedMode();
      this.setMode(cur === 'dark' ? 'light' : 'dark');
    },

    /* ---- apply everything ---- */
    apply(initial) {
      const s = this.state;
      const root = document.documentElement;
      const mode = this.resolvedMode();
      const prevMode = root.getAttribute('data-theme');
      root.setAttribute('data-theme', mode);

      this.applyAccent(mode);
      this.applyGlass();
      this.applyWallpaper(mode);

      const app = document.getElementById('app');
      if (app) app.classList.toggle('sidebar-collapsed', !!s.sidebarHidden && window.innerWidth > 768);

      // Update theme toggle buttons if any exist in DOM
      const themeBtn = document.getElementById('themeToggleBtn');
      if (themeBtn) {
        const isDark = mode === 'dark';
        themeBtn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        const span = themeBtn.querySelector('span');
        if (span) span.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        const svg = themeBtn.querySelector('svg');
        if (svg) {
          svg.innerHTML = isDark
            ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
            : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        }
      }

      // Keep legacy store in sync if present
      const store = window.convosisStore;
      if (store && store.state && store.state.themeMode !== mode) {
        store.state.themeMode = mode;
        store.saveState();
      }
      if (!initial && prevMode !== mode) this.emit();
      this.refreshPanels();
    },

    applyAccent(mode) {
      const a = ACCENTS.find(x => x.id === this.state.accent) || ACCENTS[0];
      const root = document.documentElement.style;
      const rgb = hexToRgb(a.base).join(', ');
      const text = mode === 'dark' ? mix(a.base, '#ffffff', 0.28) : mix(a.base, '#000000', a.k);
      const from = mix(a.base, '#ffffff', 0.14);
      const to = mix(a.base, '#000000', 0.1);
      const set = (k, v) => root.setProperty(k, v);

      set('--accent', a.base);
      set('--accent-rgb', rgb);
      set('--accent-text', text);
      set('--accent-from', from);
      set('--accent-to', to);
      set('--accent-on', a.on || '#ffffff');

      // Global themed variables used across modules and styles
      set('--convosis-cyan', a.base);
      set('--convosis-blue', to);
      set('--convosis-blue-dark', mix(to, '#000000', 0.15));
      set('--convosis-gradient', `linear-gradient(135deg, ${from} 0%, ${to} 100%)`);
      set('--convosis-cyan-glow', `rgba(${rgb}, 0.32)`);
      set('--convosis-glow-border', `rgba(${rgb}, 0.35)`);
      set('--text-accent', text);
      set('--border-highlight', `rgba(${rgb}, 0.45)`);
      set('--shadow-glow', `0 4px 18px rgba(${rgb}, 0.3)`);
      set('--shadow-glow-active', `0 6px 26px rgba(${rgb}, 0.45)`);
      set('--pastel-sky-bg', `rgba(${rgb}, 0.16)`);
      set('--pastel-sky-border', `rgba(${rgb}, 0.34)`);
      set('--pastel-sky-text', text);
      set('--pastel-sky-accent', a.base);
      set('--pastel-sky-hover', `rgba(${rgb}, 0.22)`);
      set('--status-info', text);
      set('--status-info-bg', `rgba(${rgb}, 0.16)`);
      set('--blue', a.base);
      set('--blue2', to);
      set('--bd-focus', a.base);
    },

    applyGlass() {
      const s = this.state, root = document.documentElement.style;
      root.setProperty('--glass-blur', clamp(+s.glassBlur, 0, 80) + 'px');
      root.setProperty('--glass-alpha', (clamp(+s.glassOpacity, 20, 100) / 100).toFixed(2));
      root.setProperty('--glass-sat', clamp(+s.glassSat, 100, 300) + '%');
    },

    applyWallpaper(mode) {
      const s = this.state, root = document.documentElement.style;
      const wp = document.getElementById('wallpaper');
      if (!wp) return;

      root.setProperty('--wp-blur', clamp(+s.wpBlur, 0, 60) + 'px');
      const dim = clamp(+s.wpDim / 100 + (mode === 'dark' ? 0.35 : 0), 0, 0.88);
      root.setProperty('--wp-dim', dim.toFixed(2));
      wp.classList.toggle('wp-animated', !!s.animate);

      const layers = wp.querySelectorAll('.wp-image');
      let css = null, key = 'none';
      if (s.wallpaper === 'custom' && this.custom && this.custom.src) {
        css = `url("${String(this.custom.src).replace(/"/g, '%22')}") center / cover no-repeat`;
        key = 'custom:' + this.custom.src.length + ':' + this.custom.src.slice(-24);
      } else if (s.wallpaper !== 'none') {
        const w = WALLPAPERS.find(x => x.id === s.wallpaper) || WALLPAPERS[0];
        css = w.css;
        key = w.id;
      }
      if (key === this._wpKey) return;
      this._wpKey = key;

      if (!css) { layers.forEach(l => l.classList.remove('on')); return; }
      this._wpIdx = 1 - this._wpIdx;                       // cross-fade between two layers
      const next = layers[this._wpIdx], prev = layers[1 - this._wpIdx];
      if (next) {
        next.style.background = css;
        next.style.backgroundSize = 'cover';
        next.style.backgroundPosition = 'center';
        next.classList.add('on');
      }
      if (prev) {
        prev.classList.remove('on');
      }
    },

    emit() {
      window.dispatchEvent(new CustomEvent('convosis:appearance', { detail: { mode: this.resolvedMode(), accent: this.state.accent } }));
    },

    /* ---- setters used by the UI ---- */
    setMode(m) { this.state.mode = m; this.save(); this.apply(); this.emit(); },
    setAccent(id) { this.state.accent = id; this.save(); this.apply(); this.emit(); },
    setWallpaper(id) { this.state.wallpaper = id; this.save(); this.apply(); },
    setAnimate(v) { this.state.animate = !!v; this.save(); this.apply(); },
    setGlassPreset(id) {
      const p = GLASS_PRESETS[id]; if (!p) return;
      Object.assign(this.state, { glassPreset: id, glassBlur: p.glassBlur, glassOpacity: p.glassOpacity, glassSat: p.glassSat });
      this.save(); this.apply(); this.syncControls();
    },
    setSidebarHidden(v) {
      this.state.sidebarHidden = !!v; this.save();
      const app = document.getElementById('app');
      if (app) app.classList.toggle('sidebar-collapsed', !!v);
    },

    // slider changes — no re-render so dragging stays ultra-smooth
    live(key, value) {
      this.state[key] = Number(value);
      if (key.indexOf('glass') === 0) this.state.glassPreset = 'custom';
      const mode = this.resolvedMode();
      this.applyGlass();
      this.applyWallpaper(mode);
      this.save();
      this.syncControls();
    },

    syncControls() {
      document.querySelectorAll('.ap-root input[data-key]').forEach(inp => {
        const k = inp.dataset.key, min = +inp.min, max = +inp.max;
        if (document.activeElement !== inp) inp.value = this.state[k];
        inp.style.setProperty('--pct', ((inp.value - min) / (max - min) * 100) + '%');
      });
      document.querySelectorAll('.ap-root [data-val]').forEach(el => {
        const k = el.dataset.val;
        el.textContent = this.state[k] + (k === 'glassBlur' || k === 'wpBlur' ? 'px' : '%');
      });
      document.querySelectorAll('.ap-root [data-preset]').forEach(b => b.classList.toggle('on', b.dataset.preset === this.state.glassPreset));
    },

    /* ---- custom wallpaper ---- */
    pickFile() {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => { if (inp.files && inp.files[0]) this.uploadFile(inp.files[0]); };
      inp.click();
    },

    uploadFile(file) {
      if (!file || !/^image\//.test(file.type)) { toast('Please choose an image file.'); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const MAX = 1920, r = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        this.setCustom(c.toDataURL('image/jpeg', 0.82), file.name);
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image.'); };
      img.src = url;
    },

    applyUrl(btn) {
      const input = btn.closest('.wp-url').querySelector('input');
      const v = (input.value || '').trim();
      if (!/^https?:\/\//i.test(v)) { toast('Enter a full image URL starting with https://'); return; }
      const img = new Image();
      img.onload = () => this.setCustom(v, 'Image URL');
      img.onerror = () => toast('That URL could not be loaded as an image.');
      img.src = v;
    },

    setCustom(src, name) {
      this.custom = { src, name };
      let persisted = true;
      try { localStorage.setItem(WP_KEY, JSON.stringify(this.custom)); } catch (e) { persisted = false; }
      this.state.wallpaper = 'custom';
      this._wpKey = null;
      this.save(); this.apply();
      toast(persisted ? 'Custom wallpaper applied' : 'Wallpaper applied (too large to keep after reload)');
    },

    clearCustom() {
      this.custom = null;
      try { localStorage.removeItem(WP_KEY); } catch (e) { /* ignore */ }
      if (this.state.wallpaper === 'custom') this.state.wallpaper = DEFAULTS.wallpaper;
      this._wpKey = null;
      this.save(); this.apply();
    },

    reset() {
      this.custom = null;
      try { localStorage.removeItem(WP_KEY); } catch (e) { /* ignore */ }
      const hidden = this.state.sidebarHidden;
      this.state = Object.assign({}, DEFAULTS, { sidebarHidden: hidden });
      this._wpKey = null;
      this.save(); this.apply(); this.emit();
      toast('Appearance reset to defaults');
    },

    /* ---- drawer ---- */
    openDrawer() { this.ensureDom(); this.refreshPanels(); document.getElementById('appearanceDrawer').classList.add('open'); },
    closeDrawer() { const d = document.getElementById('appearanceDrawer'); if (d) d.classList.remove('open'); },
    toggleDrawer() { const d = document.getElementById('appearanceDrawer'); (d && d.classList.contains('open')) ? this.closeDrawer() : this.openDrawer(); },

    refreshPanels() {
      document.querySelectorAll('.ap-root').forEach(el => { el.innerHTML = this.panelHTML(); });
      this.syncControls();
    },

    /* ---- panel markup (used by the drawer and the Settings page) ---- */
    panelHTML() {
      const s = this.state;
      const modeBtn = (m, label) => `<button class="${s.mode === m ? 'on' : ''}" onclick="ThemeEngine.setMode('${m}')">${label}</button>`;
      const slider = (key, label, min, max, step) => `
        <div class="ap-slider">
          <div class="ap-slider-top"><span>${label}</span><span class="ap-val" data-val="${key}"></span></div>
          <input type="range" class="mac-range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}" oninput="ThemeEngine.live('${key}', this.value)">
        </div>`;
      const check = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      const accent = ACCENTS.find(a => a.id === s.accent) || ACCENTS[0];

      const tiles = WALLPAPERS.map(w => `
        <button class="wp-tile ${s.wallpaper === w.id ? 'on' : ''}" style="background:${w.css}" title="${w.name}" onclick="ThemeEngine.setWallpaper('${w.id}')">
          <span class="wp-check">${check}</span><span class="wp-name">${w.name}</span>
        </button>`).join('');

      const customTile = this.custom ? `
        <button class="wp-tile ${s.wallpaper === 'custom' ? 'on' : ''}" style="background:url('${String(this.custom.src).replace(/'/g, '%27')}') center/cover" title="Your wallpaper" onclick="ThemeEngine.setWallpaper('custom')">
          <span class="wp-check">${check}</span><span class="wp-name">Yours</span>
        </button>` : '';

      return `
      <div class="ap">
        <div class="ap-sec">
          <div class="ap-h">Theme Mode</div>
          <div class="ap-desc">Select Light, Dark, or automatically match your system.</div>
          <div class="seg">${modeBtn('light', 'Light')}${modeBtn('dark', 'Dark')}${modeBtn('auto', 'Auto')}</div>
        </div>

        <div class="ap-sec">
          <div class="ap-h">Color Accent</div>
          <div class="ap-desc">Dynamic color for active pills, links, glowing borders & highlights.</div>
          <div class="swatches">
            ${ACCENTS.map(a => `<button class="sw ${s.accent === a.id ? 'on' : ''}" style="--c:${a.base}" title="${a.name}" onclick="ThemeEngine.setAccent('${a.id}')"></button>`).join('')}
          </div>
          <div class="sw-label">${accent.name}</div>
        </div>

        <div class="ap-sec wide">
          <div class="ap-h">macOS Wallpaper</div>
          <div class="ap-desc">Translucent glass shines through this backdrop. Choose a built-in wallpaper or upload your own.</div>
          <div class="wp-grid">
            ${tiles}
            ${customTile}
            <button class="wp-tile wp-action" onclick="ThemeEngine.pickFile()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload image
            </button>
            <button class="wp-tile wp-action ${s.wallpaper === 'none' ? 'on' : ''}" onclick="ThemeEngine.setWallpaper('none')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>
              No wallpaper
            </button>
          </div>
          <div class="wp-url">
            <input class="form-control" type="url" placeholder="…or paste image URL (https://)">
            <button class="btn btn-secondary btn-sm" onclick="ThemeEngine.applyUrl(this)">Apply</button>
          </div>
          ${slider('wpBlur', 'Wallpaper Blur', 0, 40, 1)}
          ${slider('wpDim', 'Wallpaper Dimming', 0, 60, 1)}
          <div class="ap-row">
            <span>Slowly drift wallpaper</span>
            <label class="mac-switch"><input type="checkbox" ${s.animate ? 'checked' : ''} onchange="ThemeEngine.setAnimate(this.checked)"><i></i></label>
          </div>
          ${this.custom ? '<div class="ap-row"><span>Custom wallpaper: ' + String(this.custom.name || 'image').replace(/[<>&"]/g, '') + '</span><button class="btn btn-secondary btn-sm" onclick="ThemeEngine.clearCustom()">Remove</button></div>' : ''}
        </div>

        <div class="ap-sec wide">
          <div class="ap-h">Glassmorphism Engine</div>
          <div class="ap-desc">Tune optical blur, specular opacity and background vibrancy in real time.</div>
          <div class="seg">
            ${Object.keys(GLASS_PRESETS).map(id => `<button data-preset="${id}" class="${s.glassPreset === id ? 'on' : ''}" onclick="ThemeEngine.setGlassPreset('${id}')">${GLASS_PRESETS[id].name}</button>`).join('')}
          </div>
          ${slider('glassBlur', 'Optical Blur', 0, 60, 1)}
          ${slider('glassOpacity', 'Surface Opacity', 20, 100, 1)}
          ${slider('glassSat', 'Color Vibrancy', 100, 260, 5)}
        </div>

        <div class="ap-footer wide">
          <span class="ap-desc" style="margin:0">Preferences persisted locally</span>
          <button class="btn btn-secondary btn-sm" onclick="ThemeEngine.reset()">Reset to Defaults</button>
        </div>
      </div>`;
    }
  };

  window.ThemeEngine = ThemeEngine;

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeEngine.init());
  } else {
    ThemeEngine.init();
  }
})();
