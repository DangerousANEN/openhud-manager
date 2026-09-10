/* PROTOKOL "fennec-pro" — faithful drweissbrot/cs-hud fennec layout.
   Radar math and WS transport are unchanged (they are proven); the roster and
   focused-player renderers were rewritten to emit the ORIGINAL two-row grid
   card and the skewed health|name+stats|ammo bar. */
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
    camWrap: $('cam-wrap'), camHp: $('cam-hp'), camArmor: $('cam-armor'),
    camArmorIcon: $('cam-armor-icon'), camName: $('cam-name'),
    camK: $('cam-k'), camA: $('cam-a'), camD: $('cam-d'),
    camRoundkills: $('cam-roundkills'),
    camAmmo: $('cam-ammo'), camReserve: $('cam-reserve'),
    alive: $('alive'), paCt: $('pa-ct'), paT: $('pa-t'),
    pips: $('round-pips'), seriesName: $('series-name'),
  };

  var RADARS = {};
  function loadRadars(tries) {
    fetch('assets/radars.json').then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { RADARS = j; if (lastSnap) render(lastSnap); })
      .catch(function () { if (tries > 0) setTimeout(function () { loadRadars(tries - 1); }, 2000); });
  }
  loadRadars(15);

  var lastSnap = null;
  var sidesReversed = false;
  var dotEls = new Map();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sanitizeMap(m) { return (m || '').toLowerCase().replace(/[^a-z0-9_]/g, ''); }
  function isLiveCam() {
    return window.location.search.indexOf('cam=live') !== -1 ||
      localStorage.getItem('cam_mode') === 'live';
  }

  /* ── Radar (unchanged math: Eidetic offset/scale formula) ── */
  function renderRadar(snap) {
    var key = sanitizeMap(snap.map);
    var cfg = RADARS[key];
    if (!cfg || !snap.players.length) { els.radar.classList.add('hidden'); return; }
    els.radar.classList.remove('hidden');
    var src = 'assets/radar-maps-clean/' + (cfg.image || key + '.webp').replace('.webp', '.png');
    if (els.radarImg.src.indexOf(key) === -1) els.radarImg.src = src;

    var seen = new Set();
    snap.players.forEach(function (p) {
      seen.add(p.steamid);
      var dot = dotEls.get(p.steamid);
      var dead = p.health <= 0;
      var hasPos = p.pos_x !== 0 || p.pos_y !== 0;
      var x = null, y = null;
      if (hasPos && cfg.resolution) {
        x = ((p.pos_x - cfg.offset.x) / cfg.resolution / 1024) * 100;
        y = ((p.pos_y - cfg.offset.y) / -cfg.resolution / 1024) * 100;
        x = Math.max(-2, Math.min(102, x));
        y = Math.max(-2, Math.min(102, y));
      }
      if (!dot) {
        dot = document.createElement('div');
        els.radarDots.appendChild(dot);
        dotEls.set(p.steamid, dot);
      }
      dot.className = 'radar-dot --' + String(p.team || '').toLowerCase() +
        (dead ? ' --dead' : '') +
        (p.steamid === snap.focused_steamid ? ' --focused' : '');
      if (dead) { dot.textContent = '\u2715'; dot.style.left = ''; dot.style.top = ''; }
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
      els.radarBomb.classList.remove('hidden');
      els.radarBomb.style.left = '50%'; els.radarBomb.style.top = '50%';
    } else els.radarBomb.classList.add('hidden');
  }

  /* ── Sidebar card: ORIGINAL fennec two-row grid ── */
  function weaponImg(name, cls) {
    if (!name) return '';
    return '<img class="' + cls + '" src="assets/weapons/' + esc(name) +
      '.svg" alt="" onerror="this.style.display=\'none\'">';
  }

  function playerHtml(p, side, focusedId) {
    var dead = p.health <= 0;
    var hp = Math.max(0, Math.min(100, p.health));
    var team = String(p.team || '').toUpperCase() === 'CT' ? 'ct' : 't';
    var armorIcon = p.armor > 0
      ? (p.helmet ? 'assets/icons/armor-helmet.svg' : 'assets/icons/armor.svg') : '';
    var rk = p.round_kills > 0
      ? '<img src="assets/icons/hs.svg" alt=""><b>' + p.round_kills + '</b>' : '';

    var health = '<div class="p-health">' + hp + '</div>';
    var slot = '<div class="p-slot">' + (p.observer_slot || '') + '</div>';
    var name = '<div class="p-name">' + esc(p.name) + '</div>';
    var kills = '<div class="p-round-kills">' + rk + '</div>';
    var primary = '<div class="p-primary">' + weaponImg(p.weapon, 'w-primary') + '</div>';
    var equip = '<div class="p-equip">' +
      (armorIcon ? '<img src="' + armorIcon + '" alt="">' : '') +
      (p.defusekit ? '<img src="assets/icons/defuser.svg" alt="">' : '') + '</div>';
    var moneykd = '<div class="p-moneykd">' +
      '<span class="p-money">$' + (p.money || 0) + '</span>' +
      '<span class="p-kd"><i>K</i>' + (p.kills || 0) + ' <i>D</i>' + (p.deaths || 0) + '</span>' +
      '</div>';
    var nades = '<div class="p-grenades">' +
      (p.grenades || []).slice(0, 4).map(function (g) {
        return '<img class="nade-' + esc(g) + '" src="assets/weapons/' + esc(g) +
          '.svg" alt="" onerror="this.style.display=\'none\'">';
      }).join('') + '</div>';
    var secondary = '<div class="p-secondary">' +
      (p.has_bomb ? '<img class="c4-mark" src="assets/icons/c4.svg" alt="C4">' : '') +
      '</div>';

    return '<div class="player-wrapper --' + side +
      (p.steamid === focusedId ? ' --focused' : '') + '" data-sid="' + esc(p.steamid) + '">' +
      '<div class="player --' + side + ' --' + team + (dead ? ' --dead' : '') + '">' +
        '<div class="health-bar-background">' +
          '<div class="health-fill" style="transform:scaleX(' + (hp / 100) + ')"></div>' +
        '</div>' +
        health + slot + name + kills + primary +
        equip + moneykd + nades + secondary +
      '</div>' +
      '<div class="fp-highlight"></div>' +
      '</div>';
  }

  function renderRosters(snap) {
    var all = snap.players || [];
    var leftTeam = sidesReversed ? 'T' : 'CT';
    var rightTeam = sidesReversed ? 'CT' : 'T';
    var left = all.filter(function (p) { return p.team === leftTeam; });
    var right = all.filter(function (p) { return p.team === rightTeam; });
    els.ctList.innerHTML = left.map(function (p) {
      return playerHtml(p, 'left', snap.focused_steamid);
    }).join('');
    els.tList.innerHTML = right.map(function (p) {
      return playerHtml(p, 'right', snap.focused_steamid);
    }).join('');

    if (els.alive) {
      els.alive.classList.remove('hidden');
      els.paCt.textContent = left.filter(function (p) { return p.health > 0; }).length;
      els.paT.textContent = right.filter(function (p) { return p.health > 0; }).length;
    }
  }

  /* ── Focused player: skewed health | name+stats | ammo ── */
  function renderCam(snap) {
    var f = null;
    for (var i = 0; i < snap.players.length; i++) {
      if (snap.players[i].steamid === snap.focused_steamid) { f = snap.players[i]; break; }
    }
    var w = els.camWrap;
    if (!f) { w.classList.remove('visible'); return; }
    w.classList.add('visible');

    var isCt = String(f.team || '').toUpperCase() === 'CT';
    w.classList.toggle('--ct', isCt);
    w.classList.toggle('--t', !isCt);

    els.camHp.textContent = Math.max(0, f.health);
    els.camArmor.textContent = f.armor || 0;
    els.camArmorIcon.src = f.helmet
      ? 'assets/icons/armor-helmet.svg' : 'assets/icons/armor.svg';
    els.camName.textContent = f.name;
    els.camK.textContent = f.kills || 0;
    els.camA.textContent = f.assists || 0;
    els.camD.textContent = f.deaths || 0;
    els.camRoundkills.textContent = f.round_kills || 0;
    els.camAmmo.textContent = (f.ammo_clip == null ? '-' : f.ammo_clip);
    els.camReserve.textContent = '/ ' + (f.ammo_reserve == null ? '-' : f.ammo_reserve);

    var live = isLiveCam();
    w.classList.toggle('live-cam', live);
    var av = $('fp-avatar');
    if (av) {
      av.style.backgroundImage = live
        ? 'none' : 'url(assets/agents-' + (isCt ? 'ct' : 't') + '.png)';
    }
    var kit = $('fp-kit'), bomb = $('fp-bomb');
    if (kit) kit.hidden = !(f.defusekit && isCt);
    if (bomb) bomb.hidden = !f.has_bomb;

    var wIcon = $('fp-weapon');
    if (wIcon) {
      if (f.weapon) {
        wIcon.src = 'assets/weapons/' + f.weapon + '.svg';
        wIcon.hidden = false;
        wIcon.onerror = function () { wIcon.hidden = true; };
      } else {
        wIcon.hidden = true;
      }
    }
    var nadeBox = $('fp-nades');
    if (nadeBox) {
      nadeBox.innerHTML = (f.grenades || []).slice(0, 4).map(function (g) {
        return '<img class="nade-' + esc(g) + '" src="assets/weapons/' + esc(g) +
          '.svg" alt="" onerror="this.style.display=\'none\'">';
      }).join('');
    }
  }

  function renderTopBar(snap) {
    els.topbar.classList.remove('hidden');
    var ctN = sidesReversed ? snap.t_name : snap.ct_name;
    var tN = sidesReversed ? snap.ct_name : snap.t_name;
    els.ctName.textContent = ctN || '';
    els.tName.textContent = tN || '';
    if (ctN) els.ctLogo.style.backgroundImage = 'url(team-logos/' + encodeURIComponent(ctN) + '.png)';
    if (tN) els.tLogo.style.backgroundImage = 'url(team-logos/' + encodeURIComponent(tN) + '.png)';
    els.ctScore.textContent = sidesReversed ? snap.t_score : snap.ct_score;
    els.tScore.textContent = sidesReversed ? snap.ct_score : snap.t_score;
    els.timer.textContent = snap.phase === 'live'
      ? (snap.round_time || '') : (snap.phase === 'over' ? '0:00' : '');
    els.roundLabel.textContent = snap.round > 0 ? 'ROUND ' + snap.round : '';
  }

  function render(snap) {
    lastSnap = snap;
    if (!snap.players || !snap.players.length) return;
    renderTopBar(snap);
    renderRosters(snap);
    renderCam(snap);
    renderRadar(snap);
  }

  function connect() {
    var ws = new WebSocket(WS_URL);
    ws.onmessage = function (ev) {
      var msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (window.PROTOKOL_EVENTS && window.PROTOKOL_EVENTS.handle(msg)) {
        sidesReversed = window.PROTOKOL_EVENTS.state().sidesReversed;
        return;
      }
      render(msg);
    };
    ws.onclose = function () { setTimeout(connect, 2000); };
  }
  connect();

  fetch('/api/state').then(function (r) { return r.json(); }).then(render).catch(function () {});
})();
