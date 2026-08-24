/* OpenHUD "fennec-pro" — Eidetic Fennec layout port: radar, cards, cam. */
(function () {
  'use strict';
  var loc = window.location;
  var proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  var WS_URL = proto + '//' + loc.host + '/ws';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    topbar: $('topbar'), ctName: $('ct-name'), tName: $('t-name'),
    ctScore: $('ct-score'), tScore: $('t-score'), timer: $('timer'),
    roundLabel: $('round-label'), ctLogo: $('ct-logo'), tLogo: $('t-logo'),
    ctList: $('ct-list'), tList: $('t-list'),
    radar: $('radar'), radarImg: $('radar-img'), radarDots: $('radar-dots'),
    radarBomb: $('radar-bomb'),
    camWrap: $('cam-wrap'), camHp: $('cam-hp'),
    camRoundkills: $('cam-roundkills'),
    camName: $('cam-name'), camKd: $('cam-kd'), camAmmo: $('cam-ammo'),
  };

  var RADARS = {};
  function loadRadars(tries) {
    fetch('assets/radars.json').then(r => { if (!r.ok) throw 0; return r.json(); })
      .then(j => { RADARS = j; if (lastSnap) render(lastSnap); })
      .catch(() => { if (tries > 0) setTimeout(() => loadRadars(tries - 1), 2000); });
  }
  loadRadars(15);
  var lastSnap = null;
  var sidesReversed = false;
  var dotEls = new Map(); // steamid -> element

  function fmtMoney(m) {
    return m >= 1000 ? '$' + (m / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : '$' + m;
  }
  function sanitizeMap(m) {
    return (m || '').toLowerCase().replace(/^de_/, 'de_').replace(/[^a-z0-9_]/g, '');
  }

  /* ── Radar ───────────────────────────────── */
  function renderRadar(snap) {
    var key = sanitizeMap(snap.map);
    var cfg = RADARS[key];
    if (!cfg || !snap.players.length) { els.radar.classList.add('hidden'); return; }
    els.radar.classList.remove('hidden');
    var src = 'assets/radar-maps-clean/' + (cfg.image || key + '.webp').replace('.webp', '.png');
    if (!els.radarImg.src.includes(key)) els.radarImg.src = src;

    var seen = new Set();
    snap.players.forEach(function (p) {
      seen.add(p.steamid);
      var dot = dotEls.get(p.steamid);
      var dead = p.health <= 0;
      var hasPos = p.pos_x !== 0 || p.pos_y !== 0;
      var x = null, y = null;
      if (hasPos && cfg.resolution) {
        // Eidetic formula: ((x - pos_x) / scale / 1024) * 100 with scale = resolution
        x = ((p.pos_x - cfg.offset.x) / cfg.resolution / 1024) * 100;
        y = ((p.pos_y - cfg.offset.y) / -cfg.resolution / 1024) * 100;
        x = Math.max(-2, Math.min(102, x));
        y = Math.max(-2, Math.min(102, y));
      }
      if (!dot) {
        dot = document.createElement('div');
        dot.className = 'radar-dot';
        els.radarDots.appendChild(dot);
        dotEls.set(p.steamid, dot);
      }
      dot.className = 'radar-dot ' + p.team.toLowerCase() +
        (dead ? ' dead' : '') +
        (p.steamid === snap.focused_steamid ? ' focused' : '');
      if (dead) { dot.textContent = '✕'; dot.style.left = ''; dot.style.top = ''; }
      else {
        dot.textContent = p.observer_slot || '';
        if (x !== null) { dot.style.display = ''; dot.style.left = x + '%'; dot.style.top = y + '%'; }
        else dot.style.display = 'none';
      }
    });
    dotEls.forEach(function (dot, id) {
      if (!seen.has(id)) { dot.remove(); dotEls.delete(id); }
    });

    if (snap.bomb === 'planted') {
      // Bomb position is not in the flat snapshot yet; show banner only.
      els.radarBomb.classList.remove('hidden');
      els.radarBomb.style.left = '50%'; els.radarBomb.style.top = '50%';
    } else els.radarBomb.classList.add('hidden');
  }

  /* ── Rosters (Eidetic card style) ────────── */
  function cardHtml(p, leftTeamName, rightTeamName) {
    var dead = p.health <= 0;
    var hp = Math.max(0, Math.min(100, p.health));
    var weaponIcon = p.weapon
      ? '<img src="assets/weapons/' + p.weapon + '.svg" alt="" onerror="this.style.display=\'none\'" />'
      : '';
    var ammo = (p.ammo_clip || p.ammo_reserve)
      ? '<span class="pammo">' + p.ammo_clip + ' / ' + p.ammo_reserve + '</span>' : '';
    return '<div class="pcard' + (dead ? ' is-dead' : '') +
      '" data-sid="' + p.steamid + '">' +
      '<div class="pslot">' + (p.observer_slot || '') + '</div>' +
      '<div class="pmid">' +
        '<div class="prow1"><span class="pname">' + p.name + '</span>' +
          '<span class="pkda">' + p.kills + ' : ' + p.deaths + ' : ' + p.assists + '</span>' +
          '<span class="pmoney">' + fmtMoney(p.money) + '</span></div>' +
        '<div class="phpline"><div class="phpbar"><i style="width:' + hp + '%"></i></div>' +
          '<span class="phpnum">' + hp + '</span>' +
          '<span class="parmor">' + (p.armor > 0 ? '🛡' + p.armor : '') + '</span></div>' +
      '</div>' +
      '<div class="pweapon">' + ammo + weaponIcon + '</div>' +
      '</div>';
  }

  function renderRosters(snap) {
    var alive = snap.players.filter(function (p) { return true; });
    var left = sidesReversed
      ? alive.filter(p => p.team === 'T') : alive.filter(p => p.team === 'CT');
    var right = sidesReversed
      ? alive.filter(p => p.team === 'CT') : alive.filter(p => p.team === 'T');
    // Eidetic keeps slot order top→bottom; column-reverse shows newest death at top.
    els.ctList.innerHTML = left.map(p => cardHtml(p)).join('');
    els.tList.innerHTML = right.map(p => cardHtml(p)).join('');
  }

  /* ── Focused player + webcam window ──────── */
  function renderCam(snap) {
    var f = null;
    for (var i = 0; i < snap.players.length; i++) {
      if (snap.players[i].steamid === snap.focused_steamid) { f = snap.players[i]; break; }
    }
    document.querySelectorAll('.pcard.focused').forEach(el => el.classList.remove('focused'));
    if (!f) { els.camWrap.classList.remove('visible'); return; }
    els.camWrap.classList.add('visible');
    var card = document.querySelector('.pcard[data-sid="' + f.steamid + '"]');
    if (card) card.classList.add('focused');
    els.camHp.textContent = Math.max(0, f.health);
    var hasHelmet = f.armor > 0;
    document.querySelector('#cam-wrap .fp-armor img').src =
      hasHelmet ? 'assets/icons/armor-helmet.svg' : 'assets/icons/armor.svg';
    els.camName.textContent = f.name;
    els.camKd.textContent = f.kills + '/' + f.assists + '/' + f.deaths;
    if (els.camRoundkills) els.camRoundkills.textContent = f.round_kills || 0;
    els.camAmmo.innerHTML = '';
    els.camAmmo.textContent = (f.ammo_clip || 0) + '';
    var resv = document.getElementById('cam-reserve');
    if (resv) resv.textContent = '/' + (f.ammo_reserve || 0);
    var wrapEl = els.camWrap;
    wrapEl.classList.toggle('ct', (f.team || '').toUpperCase() === 'CT');
    var av = document.getElementById('fp-avatar');
    if (av) {
      var side = (f.team || 'T').toUpperCase() === 'CT' ? 'ct' : 't';
      av.style.backgroundImage = 'url(assets/agents-' + side + '.png)';
    }
    var kit = document.getElementById('fp-kit'), bomb = document.getElementById('fp-bomb');
    if (kit) kit.style.display = 'none';
    if (bomb) bomb.style.display = 'none';
  }

  function render(snap) {
    lastSnap = snap;
    if (!snap.players || !snap.players.length) return;
    els.topbar.classList.remove('hidden');
    var ctN = sidesReversed ? snap.t_name : snap.ct_name;
    var tN = sidesReversed ? snap.ct_name : snap.t_name;
    els.ctName.textContent = ctN; els.tName.textContent = tN;
    els.ctLogo.style.backgroundImage = 'url(team-logos/' + encodeURIComponent(ctN) + '.png)';
    els.tLogo.style.backgroundImage = 'url(team-logos/' + encodeURIComponent(tN) + '.png)';
    els.ctScore.textContent = sidesReversed ? snap.t_score : snap.ct_score;
    els.tScore.textContent = sidesReversed ? snap.ct_score : snap.t_score;
    els.timer.textContent = snap.phase === 'live'
      ? (snap.round_time || '') : (snap.phase === 'over' ? '0:00' : '');
    els.roundLabel.textContent = snap.round > 0 ? 'ROUND ' + snap.round : '';
    renderRosters(snap);
    renderCam(snap);
    renderRadar(snap);
  }

  function connect() {
    var ws = new WebSocket(WS_URL);
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (window.PROTOKOL_EVENTS && window.PROTOKOL_EVENTS.handle(msg)) {
        var st = window.PROTOKOL_EVENTS.state();
        sidesReversed = st.sidesReversed;
        return;
      }
      render(msg);
    };
    ws.onclose = () => setTimeout(connect, 2000);
  }
  connect();

  fetch('/api/state').then(r => r.json()).then(render).catch(() => {});
})();
