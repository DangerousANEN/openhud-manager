/* PROTOKOL HUD core — shared plumbing only.
 *
 * This file deliberately contains NO layout and NO markup. It owns the parts
 * that are proven and must never be re-implemented per HUD:
 *   - WebSocket transport + reconnect
 *   - radars.json loading with retry
 *   - the Eidetic radar coordinate formula
 *   - GSI snapshot normalisation helpers
 *
 * Each HUD ships its own hud.js that calls ProtokolCore.start(renderFn) and
 * builds whatever DOM it wants. Two HUDs sharing this file are NOT the same
 * HUD — they share a data feed, the way two broadcasters share a camera.
 */
window.ProtokolCore = (function () {
  'use strict';

  var loc = window.location;
  var WS_URL = (loc.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + '/ws';

  var RADARS = {};
  var lastSnap = null;
  var renderFn = null;
  var cameras = {};
  var hudOptions = { radar: true, avatars: true, economy: false, logos: true };
  var socketOpen = false;
  var cameraSlots = new Map();

  /* ── Signal-loss watchdog ──
   * GSI going silent must NEVER look like a normal broadcast frame: overlay
   * keeps the last state, so operators need an on-air warning. The watchdog
   * refreshes ONLY on a frame with a NEW updated_at — local redraws of the
   * last snapshot (loadConfig tick, WS connect rebroadcast) must NOT reset it.
   * If no fresh snapshot arrives within SIGNAL_LOSS_MS, #signal-lost is shown. */
  var SIGNAL_LOSS_MS = 12000;
  var lastFrameAt = 0;
  var lastUpdatedAt = '';
  function noteFreshFrame(snap) {
    var ts = snap && snap.updated_at || '';
    if (ts === lastUpdatedAt) return;
    lastUpdatedAt = ts;
    lastFrameAt = Date.now();
    setSignalLost(false);
  }
  function setSignalLost(lost) {
    var el = document.getElementById('signal-lost');
    if (!el) return;
    el.classList.toggle('hidden', !lost);
  }
  function startSignalWatch() {
    lastFrameAt = Date.now();
    setInterval(function () {
      setSignalLost(Date.now() - lastFrameAt > SIGNAL_LOSS_MS);
    }, 1000);
  }

  function sourceFor(player) {
    var row = player && cameras[player.steamid];
    if (!row || !row.enabled || !/^(video|iframe)$/.test(row.kind)) return null;
    try {
      var u = new URL(row.url);
      if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
      if (row.kind === 'iframe' && /(^|\.)vdo\.ninja$/i.test(u.hostname)) u.searchParams.set('muted', '');
      return { url: u.href, kind: row.kind };
    } catch (_) { return null; }
  }

  function loadConfig() {
    return Promise.all([
      fetch('/api/cameras', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('cameras'); return r.json();
      }).then(function (rows) {
        var next = {};
        (Array.isArray(rows) ? rows : []).forEach(function (r) { next[r.steamid] = r; });
        cameras = next;
      }).catch(function () {}),
      fetch('/api/hud-options', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('options'); return r.json();
      }).then(function (opts) { Object.assign(hudOptions, opts); }).catch(function () {})
    ]).then(function () { if (lastSnap) draw(lastSnap); });
  }

  function disposeCamera(container) {
    var slot = cameraSlots.get(container);
    if (!slot) return;
    clearTimeout(slot.timer);
    if (slot.media.tagName === 'VIDEO') { slot.media.pause(); slot.media.removeAttribute('src'); slot.media.load(); }
    else slot.media.src = 'about:blank';
    slot.media.remove();
    cameraSlots.delete(container);
  }

  // Media plumbing only; every HUD owns the framing and placement.
  function mountCamera(container, player, liveMode) {
    if (!container) return;
    var source = sourceFor(player);
    var sid = player && player.steamid || '';
    container.dataset.sid = sid;
    var key = source ? sid + '|' + source.kind + '|' + source.url : '';
    var previous = cameraSlots.get(container);
    if (previous && previous.key === key) return; // Never restart video on every GSI tick.
    disposeCamera(container);
    container.dataset.cameraState = !player ? 'idle' : liveMode ? 'external' : 'unconfigured';
    if (!source) return;
    container.dataset.cameraState = 'loading';
    var media = document.createElement(source.kind === 'video' ? 'video' : 'iframe');
    media.dataset.protokolCamera = sid;
    Object.assign(media.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', objectFit: 'cover', background: 'transparent', zIndex: '1' });
    var slot = { key: key, media: media, timer: null };
    cameraSlots.set(container, slot);
    function state(value) { if (cameraSlots.get(container) === slot) container.dataset.cameraState = value; }
    if (source.kind === 'video') {
      media.autoplay = true; media.muted = true; media.defaultMuted = true;
      media.playsInline = true; media.loop = true;
      media.setAttribute('muted', ''); media.setAttribute('playsinline', '');
      media.addEventListener('playing', function () { clearTimeout(slot.timer); state('playing'); });
      media.addEventListener('waiting', function () { state('buffering'); });
      media.addEventListener('error', function () { clearTimeout(slot.timer); state('error'); });
      media.addEventListener('loadeddata', function () { media.play().catch(function () { state('blocked'); }); });
    } else {
      media.title = 'Camera ' + (player.name || sid);
      media.allow = 'autoplay; fullscreen';
      media.referrerPolicy = 'no-referrer';
      media.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      // Cross-origin iframe load is not evidence of incoming WebRTC frames.
      media.addEventListener('load', function () { clearTimeout(slot.timer); state('embedded'); });
      media.addEventListener('error', function () { clearTimeout(slot.timer); state('error'); });
    }
    slot.timer = setTimeout(function () { state('timeout'); }, 15000);
    media.src = source.url;
    container.appendChild(media);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function sanitizeMap(m) { return (m || '').toLowerCase().replace(/[^a-z0-9_]/g, ''); }

  function isLiveCam() {
    var mode = new URLSearchParams(loc.search).get('cam');
    if (mode) return mode === 'live';
    try { return localStorage.getItem('cam_mode') === 'live'; } catch (_) { return false; }
  }

  /* Eidetic formula — verified against real match coordinates. Do not "simplify". */
  function radarPos(player, cfg) {
    if (!cfg || !cfg.resolution) return null;
    if (player.pos_x === 0 && player.pos_y === 0) return null;
    var x = ((player.pos_x - cfg.offset.x) / cfg.resolution / 1024) * 100;
    var y = ((player.pos_y - cfg.offset.y) / -cfg.resolution / 1024) * 100;
    return {
      x: Math.max(-2, Math.min(102, x)),
      y: Math.max(-2, Math.min(102, y))
    };
  }

  /* Map art preference: Clean stylish transparent minimap (1024x1024) → Simpleradar → in-game */
  function radarArt(imgEl, mapKey) {
    if (imgEl.dataset.map === mapKey) return;
    imgEl.dataset.map = mapKey;
    var chain = [
      'assets/radar-maps-clean/' + mapKey + '_radar_psd.png',
      'assets/radar-maps-clean/' + mapKey + '.png',
      'assets/radars/simpleradar/' + mapKey + '.webp',
      'assets/radars/ingame/' + mapKey + '.webp'
    ];
    var i = 0;
    imgEl.onerror = function () {
      i += 1;
      if (i < chain.length) imgEl.src = chain[i];
      else imgEl.onerror = null;
    };
    imgEl.src = chain[0];
  }

  function loadRadars(tries) {
    fetch('assets/radars.json')
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { RADARS = j; if (lastSnap) draw(lastSnap); })
      .catch(function () {
        if (tries > 0) setTimeout(function () { loadRadars(tries - 1); }, 2000);
      });
  }

  var AGENTS_CT = [
    'assets/agents/ct_1st_lieutenant_farlow_swat.png',
    'assets/agents/ct_cmdr_mae_dead_cold_jamison_swat.png',
    'assets/agents/ct_lieutenant_rex_krikey_nswc_seal.png',
    'assets/agents/ct_special_agent_ava_fbi_swat.png',
    'assets/agents/ct_michael_syfers_fbi_sniper.png',
    'assets/agents/ct_markus_delrow_fbi_hrg.png',
    'assets/agents/ct_operator_fbi_swat.png',
    'assets/agents/ct_3rd_commando_company_ksk.png',
    'assets/agents/ct_seal_team_6_soldier_nswc_seal.png',
    'assets/agents/ct_buckshot_nswc_seal.png'
  ];
  var AGENTS_T = [
    'assets/agents/t_bloody_darryl_the_strapped_the_professionals.png',
    'assets/agents/t_sir_bloody_miami_darryl_the_professionals.png',
    'assets/agents/t_sir_bloody_loudmouth_darryl_the_professionals.png',
    'assets/agents/t_the_doctor_romanov_sabre.png',
    'assets/agents/t_blackwolf_sabre.png',
    'assets/agents/t_rezan_the_ready_sabre.png',
    'assets/agents/t_maximus_sabre.png',
    'assets/agents/t_dragomir_sabre.png',
    'assets/agents/t_safecracker_voltzmann_the_professionals.png',
    'assets/agents/t_getaway_sally_the_professionals.png'
  ];

  function getPlayerAgent(player, mapKey) {
    if (!player) return '';
    if (player.avatar && player.avatar.trim() !== '') return player.avatar;
    var isCt = String(player.team || '').toUpperCase() === 'CT';
    var pool = isCt ? AGENTS_CT : AGENTS_T;
    var hash = 0;
    var str = String(player.steamid || player.name || player.observer_slot || '0');
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    var idx = Math.abs(hash) % pool.length;
    return pool[idx] || (isCt ? 'assets/agents-ct.png' : 'assets/agents-t.png');
  }

  function formatSlot(raw) {
    if (raw == null || raw === '') return '';
    var s = Number(raw);
    if (!Number.isFinite(s)) return String(raw);
    // CS2 observer slot mapping: slots 0..8 map to spectator keys 1..9, slot 9 maps to 0
    if (s >= 0 && s <= 8) return String(s + 1);
    if (s === 9) return '0';
    return String(s);
  }

  function split(snap) {
    var ct = [], t = [];
    (snap.players || []).forEach(function (p) {
      (String(p.team || '').toUpperCase() === 'CT' ? ct : t).push(p);
    });
    var slotVal = function (p) {
      return (p && p.observer_slot != null) ? Number(p.observer_slot) : 99;
    };
    var bySlot = function (a, b) { return slotVal(a) - slotVal(b); };
    ct.sort(bySlot); t.sort(bySlot);
    return { ct: ct, t: t };
  }

  function draw(snap) {
    lastSnap = snap;
    noteFreshFrame(snap);
    if (!renderFn) return;
    var sides = split(snap);
    renderFn({
      snap: snap,
      ct: sides.ct,
      t: sides.t,
      focused: (snap.players || []).filter(function (p) {
        return p.steamid && p.steamid === snap.focused_steamid;
      })[0] || null,
      radarCfg: RADARS[sanitizeMap(snap.map)] || null,
      mapKey: sanitizeMap(snap.map),
      liveCam: isLiveCam() || !!sourceFor((snap.players || []).find(function (p) { return p.steamid === snap.focused_steamid; })),
      options: hudOptions
    });
  }

  function connect() {
    var ws;
    try { ws = new WebSocket(WS_URL); } catch (e) { setTimeout(connect, 2000); return; }
    ws.onopen = function () { socketOpen = true; loadConfig(); };
    ws.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        var event = msg && (msg.type || msg.event);
        if (event === 'cameras_changed' || event === 'hud_options') { loadConfig(); return; }
        if (msg && msg.players) draw(msg);
        else if (msg && msg.data && msg.data.players) draw(msg.data);
      } catch (e) { /* ignore malformed frames */ }
    };
    ws.onclose = function () { socketOpen = false; setTimeout(connect, 1500); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }

  function pollOnce() {
    /* server exposes /api/state at the root, not relative to /overlay/<pack>/ */
    fetch('/api/state').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.players) draw(j); })
      .catch(function () {});
  }

  return {
    esc: esc,
    formatSlot: formatSlot,
    getPlayerAgent: getPlayerAgent,
    radarPos: radarPos,
    radarArt: radarArt,
    isLiveCam: isLiveCam,
    mountCamera: mountCamera,
    start: function (fn) {
      renderFn = fn;
      startSignalWatch();
      loadRadars(15);
      loadConfig();
      connect();
      pollOnce();
      setInterval(function () { if (!socketOpen) pollOnce(); }, 2000);
      setInterval(loadConfig, 5000);
      window.addEventListener('pagehide', function () { cameraSlots.forEach(function (_, el) { disposeCamera(el); }); });
    }
  };
})();
