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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function sanitizeMap(m) { return (m || '').toLowerCase().replace(/[^a-z0-9_]/g, ''); }

  function isLiveCam() {
    return loc.search.indexOf('cam=live') !== -1 ||
      localStorage.getItem('cam_mode') === 'live';
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

  /* Map art preference: SimpleRadar → in-game → outline mask. */
  function radarArt(imgEl, mapKey) {
    if (imgEl.dataset.map === mapKey) return;
    imgEl.dataset.map = mapKey;
    var chain = [
      'assets/radars/simpleradar/' + mapKey + '.webp',
      'assets/radars/ingame/' + mapKey + '.webp',
      'assets/radar-maps-clean/' + mapKey + '.png'
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

  function split(snap) {
    var ct = [], t = [];
    (snap.players || []).forEach(function (p) {
      (String(p.team || '').toUpperCase() === 'CT' ? ct : t).push(p);
    });
    var bySlot = function (a, b) { return (a.observer_slot || 99) - (b.observer_slot || 99); };
    ct.sort(bySlot); t.sort(bySlot);
    return { ct: ct, t: t };
  }

  function draw(snap) {
    lastSnap = snap;
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
      liveCam: isLiveCam()
    });
  }

  function connect() {
    var ws;
    try { ws = new WebSocket(WS_URL); } catch (e) { setTimeout(connect, 2000); return; }
    ws.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg && msg.players) draw(msg);
        else if (msg && msg.data && msg.data.players) draw(msg.data);
      } catch (e) { /* ignore malformed frames */ }
    };
    ws.onclose = function () { setTimeout(connect, 1500); };
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
    radarPos: radarPos,
    radarArt: radarArt,
    isLiveCam: isLiveCam,
    start: function (fn) {
      renderFn = fn;
      loadRadars(15);
      connect();
      pollOnce();
      setInterval(function () { if (lastSnap) draw(lastSnap); }, 5000);
    }
  };
})();
