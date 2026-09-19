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
    camAdr: $('cam-adr'),
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

  /* Catmull-Rom spline interpolation between 4 points */
  function catmullRom(p0, p1, p2, p3, t) {
    var t2 = t * t;
    var t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  }

  var RadarTracker = (function () {
    var entities = new Map();
    var rafActive = false;

    function push(id, el, targetX, targetY) {
      var now = performance.now();
      var state = entities.get(id);
      if (!state) {
        state = { el: el, samples: [{ t: now, x: targetX, y: targetY }], avgInterval: 280 };
        entities.set(id, state);
        el.style.left = targetX.toFixed(2) + '%';
        el.style.top = targetY.toFixed(2) + '%';
        startLoop();
        return;
      }
      state.el = el;
      var last = state.samples[state.samples.length - 1];
      var dt = now - last.t;
      if (dt > 40 && dt < 1500) {
        state.avgInterval = state.avgInterval * 0.7 + dt * 0.3;
      }
      var dist = Math.hypot(targetX - last.x, targetY - last.y);
      if (dist > 25) {
        state.samples = [{ t: now, x: targetX, y: targetY }];
      } else {
        state.samples.push({ t: now, x: targetX, y: targetY });
        while (state.samples.length > 2 && state.samples[0].t < (now - 2500)) {
          state.samples.shift();
        }
      }
      startLoop();
    }

    function remove(id) { entities.delete(id); }

    function startLoop() {
      if (!rafActive) {
        rafActive = true;
        requestAnimationFrame(tick);
      }
    }

    function tick() {
      var now = performance.now();
      var activeCount = 0;
      entities.forEach(function (state, id) {
        if (!state.el || !state.el.parentNode) {
          entities.delete(id);
          return;
        }
        activeCount++;
        var smp = state.samples;
        if (smp.length === 1) {
          state.el.style.left = smp[0].x.toFixed(2) + '%';
          state.el.style.top = smp[0].y.toFixed(2) + '%';
          return;
        }

        var delay = Math.min(360, Math.max(180, state.avgInterval * 1.05));
        var renderT = now - delay;

        var curX, curY;
        if (renderT <= smp[0].t) {
          curX = smp[0].x;
          curY = smp[0].y;
        } else if (renderT >= smp[smp.length - 1].t) {
          var last = smp[smp.length - 1];
          var prev = smp.length > 1 ? smp[smp.length - 2] : last;
          var segDt = last.t - prev.t;
          var extraDt = renderT - last.t;
          if (segDt > 20 && extraDt < 400) {
            var vx = (last.x - prev.x) / segDt;
            var vy = (last.y - prev.y) / segDt;
            var drag = Math.max(0, 1 - Math.pow(extraDt / 400, 2));
            curX = last.x + vx * extraDt * drag;
            curY = last.y + vy * extraDt * drag;
          } else {
            curX = last.x;
            curY = last.y;
          }
        } else {
          for (var i = 0; i < smp.length - 1; i++) {
            var s1 = smp[i];
            var s2 = smp[i + 1];
            if (s1.t <= renderT && renderT <= s2.t) {
              var segLen = s2.t - s1.t;
              var frac = segLen > 0 ? (renderT - s1.t) / segLen : 0;
              var s0 = i > 0 ? smp[i - 1] : s1;
              var s3 = (i + 2 < smp.length) ? smp[i + 2] : s2;
              curX = catmullRom(s0.x, s1.x, s2.x, s3.x, frac);
              curY = catmullRom(s0.y, s1.y, s2.y, s3.y, frac);
              break;
            }
          }
        }

        if (curX != null && curY != null) {
          state.el.style.left = curX.toFixed(2) + '%';
          state.el.style.top = curY.toFixed(2) + '%';
        }
      });

      if (activeCount > 0) requestAnimationFrame(tick);
      else rafActive = false;
    }

    return { push: push, remove: remove };
  })();

  /* ── Radar (unchanged math: Eidetic offset/scale formula) ── */
  function renderRadar(snap) {
    var key = sanitizeMap(snap.map);
    var cfg = RADARS[key];
    if (!cfg || !snap.players.length) { els.radar.classList.add('hidden'); return; }
    els.radar.classList.remove('hidden');
    /* original art first (SimpleRadar, then in-game), outline mask last */
    if (els.radarImg.dataset.map !== key) {
      els.radarImg.dataset.map = key;
      var chain = ['assets/radars/simpleradar/' + key + '.webp',
                   'assets/radars/ingame/' + key + '.webp',
                   'assets/radar-maps-clean/' + key + '.png'];
      var idx = 0;
      els.radarImg.onerror = function () {
        idx += 1;
        if (idx < chain.length) els.radarImg.src = chain[idx];
        else els.radarImg.onerror = null;
      };
      els.radarImg.src = chain[0];
    }

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
      if (dead) {
        dot.textContent = '\u2715';
        dot.style.display = 'none';
        RadarTracker.remove(p.steamid);
      } else {
        dot.textContent = C.formatSlot ? C.formatSlot(p.observer_slot) : (p.observer_slot || '');
        if (x !== null) {
          dot.style.display = '';
          RadarTracker.push(p.steamid, dot, x, y);
        } else {
          dot.style.display = 'none';
          RadarTracker.remove(p.steamid);
        }
      }
    });
    dotEls.forEach(function (dot, id) {
      if (!seen.has(id)) {
        dot.remove();
        dotEls.delete(id);
        RadarTracker.remove(id);
      }
    });

    var isPlanted = snap.bomb === 'planted' || snap.bomb_state === 'planted';
    var isDropped = snap.bomb === 'dropped' || snap.bomb_state === 'dropped';
    if (isPlanted || isDropped) {
      els.radarBomb.classList.remove('hidden');
      els.radarBomb.classList.toggle('is-dropped', isDropped);
      els.radarBomb.classList.toggle('is-planted', isPlanted);
      var bx = snap.bomb_x, by = snap.bomb_y;
      if (bx != null && by != null && (bx !== 0 || by !== 0) && cfg && cfg.resolution) {
        var bpx = ((bx - cfg.offset.x) / cfg.resolution / 1024) * 100;
        var bpy = ((by - cfg.offset.y) / -cfg.resolution / 1024) * 100;
        RadarTracker.push('__bomb__', els.radarBomb, bpx, bpy);
      } else {
        els.radarBomb.style.left = '50%'; els.radarBomb.style.top = '50%';
      }
    } else {
      els.radarBomb.classList.add('hidden');
      RadarTracker.remove('__bomb__');
    }
  }

  /* ── Sidebar card: ORIGINAL fennec two-row grid ── */
  function weaponImg(name, cls) {
    if (!name) return '';
    return '<img class="' + cls + '" src="assets/weapons/' + esc(name) +
      '.svg" alt="" onerror="this.style.display=\'none\'">';
  }

  function playerHtml(p, side, focusedId) {
    /* 1:1 with the original fennec card: 11 columns x 2 rows.
       Row 1: health | slot | name | round-kills | primary
       Row 2: equipment | money | kills | deaths | taser | grenades | secondary */
    var dead = p.health <= 0;
    var hp = Math.max(0, Math.min(100, p.health));
    var team = String(p.team || '').toUpperCase() === 'CT' ? 'ct' : 't';
    var armorIcon = p.armor > 0
      ? (p.helmet ? 'assets/icons/armor-helmet.svg' : 'assets/icons/armor.svg') : '';

    var nades = (p.grenades || []).slice(0, 4).map(function (g) {
      return '<img class="nade-' + esc(g) + '" src="assets/weapons/' + esc(g) +
        '.svg" alt="" onerror="this.style.display=\'none\'">';
    }).join('');

    return '<div class="player-wrapper --' + side +
      (p.steamid === focusedId ? ' --focused' : '') + '" data-sid="' + esc(p.steamid) + '">' +
      '<div class="player --' + side + ' --' + team + (dead ? ' --dead' : '') + '">' +
        '<div class="health-bar-background">' +
          '<div class="health-fill" style="transform:scaleX(' + (hp / 100) + ')"></div>' +
        '</div>' +
        '<div class="p-health">' + hp + '</div>' +
        '<div class="p-slot">' + (p.observer_slot || '') + '</div>' +
        '<div class="p-name">' + esc(p.name) + '</div>' +
        '<div class="p-round-kills">' + (p.round_kills > 0
          ? '<img src="assets/icons/hs.svg" alt=""><b>' + p.round_kills + '</b>' : '') + '</div>' +
        '<div class="p-primary">' + weaponImg(p.weapon, 'w-primary') + '</div>' +
        '<div class="p-equip">' +
          (armorIcon ? '<img src="' + armorIcon + '" alt="">' : '') +
          (p.defusekit ? '<img src="assets/icons/defuser.svg" alt="">' : '') + '</div>' +
        '<div class="p-money">$' + (p.money || 0) + '</div>' +
        '<div class="p-kills"><i>K</i>' + (p.kills || 0) + '</div>' +
        '<div class="p-deaths"><i>D</i>' + (p.deaths || 0) + '</div>' +
        '<div class="p-taser">' +
          (p.has_bomb ? '<img class="c4-mark" src="assets/icons/c4.svg" alt="C4">' : '') +
        '</div>' +
        '<div class="p-grenades">' + nades + '</div>' +
        '<div class="p-secondary">' +
          weaponImg(p.secondary, 'w-secondary') +
        '</div>' +
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

    renderTeamBars(left, 'ct', snap.ct_loss_streak || 0);
    renderTeamBars(right, 't', snap.t_loss_streak || 0);
    /* money strip is a freezetime-only widget upstream */
    var freeze = snap.phase === 'freezetime' || snap.phase === 'warmup';
    ['ct-equipment', 't-equipment'].forEach(function (id) {
      var e = $(id); if (e) e.classList.toggle('--active', freeze);
    });

    if (els.alive) {
      els.alive.classList.remove('hidden');
      els.paCt.textContent = left.filter(function (p) { return p.health > 0; }).length;
      els.paT.textContent = right.filter(function (p) { return p.health > 0; }).length;
    }
  }

  /* ── Team equipment + utility summary bars (upstream TeamEquipment/TeamGrenades) ── */
  var LOSS_BONUS = [1400, 1900, 2400, 2900, 3400];
  var NADE_TYPES = ['smokegrenade', 'molotov', 'flashbang', 'hegrenade'];

  function renderTeamBars(players, side, lossStreak) {
    var money = 0, equip = 0, counts = {};
    NADE_TYPES.forEach(function (t) { counts[t] = 0; });
    players.forEach(function (p) {
      money += p.money || 0;
      equip += p.equip_value || 0;
      (p.grenades || []).forEach(function (g) {
        var key = g === 'incgrenade' ? 'molotov' : g;
        if (counts[key] !== undefined) counts[key] += 1;
      });
    });
    var total = NADE_TYPES.reduce(function (a, t) { return a + counts[t]; }, 0);

    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set(side + '-money', '$' + money);
    set(side + '-equip', '$' + equip);
    set(side + '-loss', '$' + LOSS_BONUS[Math.max(0, Math.min(4, lossStreak))]);
    set(side + '-nade-total', total);

    var box = $(side + '-nade-types');
    if (box) {
      box.innerHTML = NADE_TYPES.map(function (t) {
        return '<div class="tg-type' + (counts[t] ? ' --active' : '') + '">' +
          '<img class="nade-' + t + '" src="assets/weapons/' + t +
          '.svg" alt="" onerror="this.style.display=\'none\'">' +
          '<span class="value">' + counts[t] + '</span></div>';
      }).join('');
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
    els.camAdr.textContent = f.adr || 0;
    els.camAmmo.textContent = (f.ammo_clip == null ? '-' : f.ammo_clip);
    els.camReserve.textContent = '/ ' + (f.ammo_reserve == null ? '-' : f.ammo_reserve);

    var live = isLiveCam();
    w.classList.toggle('live-cam', live);
    var av = $('fp-avatar');
    if (av) {
      var agentPic = f.avatar || ('assets/agents-' + (isCt ? 'ct' : 't') + '.png');
      av.style.backgroundImage = live
        ? 'none' : 'url(' + agentPic + ')';
    }
    var camWin = $('fp-cam-window');
    if (camWin) camWin.setAttribute('data-steamid', f.steamid || '');
    var kit = $('fp-kit'), bomb = $('fp-bomb');
    if (kit) kit.hidden = !(f.defusekit && isCt);
    if (bomb) bomb.hidden = !f.has_bomb;

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
    /* probe the logo first; a missing file must not leave a coloured square */
    var ctLogoSrc = snap.ct_logo || snap.match_left_logo || snap.left_team_logo || ('team-logos/' + encodeURIComponent(ctN) + '.png');
    var tLogoSrc = snap.t_logo || snap.match_right_logo || snap.right_team_logo || ('team-logos/' + encodeURIComponent(tN) + '.png');
    [[ctN, els.ctLogo, ctLogoSrc], [tN, els.tLogo, tLogoSrc]].forEach(function (tuple) {
      var nm = tuple[0], el = tuple[1], src = tuple[2];
      if (!el) return;
      if (!src) {
        el.classList.remove('--loaded');
        return;
      }
      var probe = new Image();
      probe.onload = function () {
        /* reject 1x1 placeholder stubs; they render as coloured squares */
        if (probe.naturalWidth < 16 || probe.naturalHeight < 16) {
          el.classList.remove('--loaded');
          return;
        }
        el.style.backgroundImage = 'url(' + JSON.stringify(src) + ')';
        el.classList.add('--loaded');
      };
      probe.onerror = function () { el.classList.remove('--loaded'); };
      probe.src = src;
    });
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
