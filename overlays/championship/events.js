/* ════════════════════════════════════════════════════════════════
   OpenHUD overlay control-event module (shared by all HUD packs).
   Consumes broadcasts from the manager over the same WebSocket:
     { type: "overlay_toggle",   data: { id, active } }
     { type: "sides_reversed",   data: { match_id } }
     { type: "sponsor_rotation", data: { sponsors: [...], interval_ms } }
   Exposes window.OpenHUD_EVENTS.handle(msg) — call it first in your
   WebSocket onmessage handler; returns true when the frame was consumed.
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // DOM ids each logical region maps to (any that exist get toggled).
  var REGIONS = {
    player_stats: ['players', 'ct-panel', 't-panel', 'obs-info'],
    team_compare: [],
    veto: [],
    round_winner: [],
    match_winner: [],
    replay: [],
  };
  var LABELS = {
    team_compare: 'TEAM COMPARISON',
    veto: 'MAP VETO',
    round_winner: 'ROUND WINNER',
    match_winner: 'MATCH WINNER',
    replay: 'REPLAY',
  };
  // Events whose banner auto-hides even while still "on".
  var AUTOHIDE_MS = { round_winner: 6000, match_winner: 6000, replay: 6000 };

  var flipped = false;
  var bannerTimers = {};
  var rotTimer = null;
  var rotQueue = [];
  var rotIdx = 0;

  // ── Regions ──
  function setRegion(id, active) {
    (REGIONS[id] || []).forEach(function (domId) {
      var el = document.getElementById(domId);
      if (el) el.classList.toggle('region-hidden', !active);
    });
    showBannerFor(id, active);
  }

  // ── Banner ──
  function ensureBanner() {
    var b = document.getElementById('openhud-event-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'openhud-event-banner';
      b.className = 'openhud-event-banner';
      document.body.appendChild(b);
    }
    return b;
  }
  function showBannerFor(id, active) {
    var b = ensureBanner();
    var label = LABELS[id] || String(id).toUpperCase();
    if (bannerTimers[id]) { clearTimeout(bannerTimers[id]); delete bannerTimers[id]; }

    if (AUTOHIDE_MS[id]) {
      // Transient plaque: flash on activation only.
      if (active) {
        b.textContent = label;
        b.classList.add('show');
        bannerTimers[id] = setTimeout(function () { b.classList.remove('show'); }, AUTOHIDE_MS[id]);
      } else {
        b.classList.remove('show');
      }
      return;
    }
    // Persistent plaque while the toggle is ON.
    if (active) { b.textContent = label; b.classList.add('show'); }
    else { b.classList.remove('show'); }
  }

  // ── Sponsor rotation ──
  function sponsorParts() {
    var slot = document.getElementById('sponsor-slot');
    return slot ? { slot: slot, img: slot.querySelector('img') } : null;
  }
  function stopRotation() {
    if (rotTimer) { clearInterval(rotTimer); rotTimer = null; }
  }
  function buildQueue(sponsors) {
    var q = [];
    (sponsors || []).forEach(function (s) {
      if (!s || !s.image) return;
      var w = Math.max(1, Math.min(10, parseInt(s.weight, 10) || 1));
      for (var i = 0; i < w; i++) q.push(s);
    });
    return q;
  }
  function startRotation(sponsors, intervalMs) {
    stopRotation();
    rotQueue = buildQueue(sponsors);
    var parts = sponsorParts();
    if (!parts || !parts.img) return;

    if (!rotQueue.length) {
      parts.slot.style.display = 'none';
      return;
    }
    parts.slot.style.display = '';
    rotIdx = 0;
    var apply = function () {
      var s = rotQueue[rotIdx % rotQueue.length];
      rotIdx++;
      // Restore visibility every tick: a single broken banner must not
      // kill the rotation (inline onerror handlers may hide the slot).
      parts.slot.style.display = '';
      parts.img.style.display = '';
      parts.img.src = s.image;
      parts.img.alt = s.name || '';
    };
    apply();
    rotTimer = setInterval(apply, Math.max(3000, intervalMs || 30000));
  }

  // ── Public API ──
  window.OpenHUD_EVENTS = {
    /** true while "Сменить стороны" is engaged — renderers swap CT/T. */
    isFlipped: function () { return flipped; },
    /** Consume one WS frame. Returns true if handled here. */
    handle: function (msg) {
      if (!msg || typeof msg !== 'object' || !msg.type) return false;
      var d = msg.data || {};
      switch (msg.type) {
        case 'overlay_toggle':
          if (REGIONS.hasOwnProperty(d.id)) setRegion(d.id, !!d.active);
          return true;
        case 'sides_reversed':
          flipped = !flipped;
          document.body.classList.toggle('sides-reversed', flipped);
          return true;
        case 'sponsor_rotation':
          startRotation(d.sponsors, d.interval_ms);
          return true;
        default:
          return false;
      }
    },
    /**
     * Swap CT/T fields+teams when sides are reversed.
     * Feed every GSI snapshot through this before rendering.
     */
    orientSnapshot: function (d) {
      if (!flipped) return d;
      var x = Object.assign({}, d);
      x.ct_score = d.t_score; x.t_score = d.ct_score;
      x.ct_name = d.t_name;   x.t_name = d.ct_name;
      if (Array.isArray(d.players)) {
        x.players = d.players.map(function (p) {
          return Object.assign({}, p, { team: p.team === 'CT' ? 'T' : 'CT' });
        });
        x.players.sort(function (a, b) { return a.team < b.team ? -1 : a.team > b.team ? 1 : 0; });
      }
      return x;
    },
  };

  // One-time styles for the banner and hidden regions.
  var css = document.createElement('style');
  css.textContent =
    '.region-hidden{display:none !important}' +
    '.openhud-event-banner{position:fixed;left:50%;top:12%;transform:translateX(-50%) translateY(-16px);' +
    'padding:14px 46px;background:rgba(10,11,14,.9);border:2px solid #e6c475;color:#f4f4f4;' +
    'font:700 32px/1 Rajdhani,"Segoe UI",Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;' +
    'border-radius:8px;opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease;z-index:99999}' +
    '.openhud-event-banner.show{opacity:1;transform:translateX(-50%) translateY(0)}';
  document.head.appendChild(css);

  console.log('[OPENHUD] control-event module ready');
})();
