/* PROTOKOL CYBER — vertical tactical HUD.
   Own renderer: emits hexagonal pods, vertical draining HP columns,
   segmented ammo ladders and a utility rail. Shares only the WS feed +
   radar math via ProtokolCore. */
(function () {
  'use strict';
  var C = window.ProtokolCore;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc;
  var dots = new Map();

  function show(el, on) { if (el) el.classList.toggle('hidden', !on); }

  function clockText(raw) {
    if (raw == null || raw === '') return '--:--';
    if (typeof raw === 'string' && raw.indexOf(':') >= 0) return raw;
    var n = Number(raw);
    if (!Number.isFinite(n)) return '--:--';
    var total = Math.max(0, Math.floor(n));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function ladder(current, max) {
    var h = '';
    for (var i = 0; i < max; i++) {
      h += '<i' + (i < current ? ' class="is-lit"' : '') + '></i>';
    }
    return h;
  }

  function weaponName(w) {
    if (!w) return '';
    var raw = String(w).replace(/^weapon_/, '').toLowerCase();
    var map = {
      'ak47': 'AK-47', 'm4a1': 'M4A4', 'm4a1_silencer': 'M4A1-S',
      'awp': 'AWP', 'deagle': 'Desert Eagle', 'usp_silencer': 'USP-S',
      'glock': 'Glock-18', 'galilar': 'Galil AR', 'famas': 'FAMAS',
      'sg553': 'SG 553', 'aug': 'AUG', 'ssg08': 'SSG 08',
      'mp9': 'MP9', 'mac10': 'MAC-10', 'mp7': 'MP7', 'mp5sd': 'MP5-SD',
      'ump45': 'UMP-45', 'p90': 'P90', 'bizon': 'PP-Bizon',
      'elite': 'Dual Berettas', 'fiveseven': 'Five-SeVeN', 'hkp2000': 'P2000',
      'p250': 'P250', 'cz75a': 'CZ75-Auto', 'tec9': 'Tec-9', 'revolver': 'R8 Revolver',
      'nova': 'Nova', 'xm1014': 'XM1014', 'sawedoff': 'Sawed-Off', 'mag7': 'MAG-7',
      'm249': 'M249', 'negev': 'Negev', 'taser': 'Zeus x27', 'knife': 'Knife'
    };
    return map[raw] || raw.toUpperCase();
  }

  function weaponHtml(w, cls) {
    if (!w) return '<span class="' + (cls || 'col-gun') + '"></span>';
    var name = weaponName(w);
    return '<span class="' + (cls || 'col-gun') + '" title="' + esc(name) + '">' +
      '<img class="gun-icon" src="assets/weapons/' + esc(w) + '.svg" alt="' + esc(name) + '" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline-block\';">' +
      '<span class="gun-fallback" style="display:none">' + esc(name) + '</span>' +
    '</span>';
  }

  /* ── One vertical column per player (draining health bar) ── */
  function columnHtml(p, side, focusedId, showMoney) {
    var hp = Math.max(0, Math.min(100, p.health));
    var dead = hp <= 0;
    var kitHtml =
      (p.armor > 0 ? '<i class="ux ux--' + (p.helmet ? 'helm' : 'vest') + '"></i>' : '') +
      (p.defusekit && side === 'ct' ? '<i class="ux ux--kit"></i>' : '') +
      (p.has_bomb ? '<i class="ux ux--bomb"></i>' : '') +
      (p.grenades || []).slice(0, 4).map(function (g) {
        return '<i class="ux nade-' + esc(g) + '"></i>';
      }).join('');

    var gunHtml = !dead && p.weapon ? weaponHtml(p.weapon, 'col-gun') : '<span class="col-gun"></span>';

    return '' +
      '<div class="col' + (dead ? ' col--dead' : '') +
        (p.steamid === focusedId ? ' col--live' : '') + '" data-sid="' + esc(p.steamid) + '">' +
        '<div class="col-slot">' + C.formatSlot(p.observer_slot) + '</div>' +
        '<div class="col-bar">' +
          '<div class="col-fill col-fill--' + side + '" style="height:' + hp + '%"></div>' +
          '<span class="col-hp">' + (dead ? '✕' : hp) + '</span>' +
        '</div>' +
        '<div class="col-body">' +
          '<div class="col-row col-row--top">' +
            '<div class="col-name">' + esc(p.name) + '</div>' +
            gunHtml +
          '</div>' +
          '<div class="col-row col-row--bottom">' +
            '<div class="col-sub">' +
              '<span class="col-kd"><b>' + (p.kills || 0) + '</b>/' + (p.deaths || 0) + '</span>' +
              '<span class="col-cash' + (showMoney ? '' : ' hidden') + '">$' + (p.money || 0) + '</span>' +
            '</div>' +
            '<div class="col-util">' + kitHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ── Single shared utility rail at the bottom ── */
  function utilHtml(players, side) {
    var counts = { smoke: 0, flash: 0, he: 0, moly: 0 };
    var alive = 0;
    players.forEach(function (p) {
      if (p.health > 0) alive++;
      (p.grenades || []).forEach(function (g) {
        if (g === 'smokegrenade') counts.smoke++;
        else if (g === 'flashbang') counts.flash++;
        else if (g === 'hegrenade') counts.he++;
        else if (g === 'molotov' || g === 'incgrenade') counts.moly++;
      });
    });

    function pill(kind, n) {
      return '<span class="ucount' + (n > 0 ? ' is-on' : '') + '">' +
        '<i class="ux nade-' + kind + '"></i><b>' + n + '</b></span>';
    }

    return '' +
      '<span class="urail-alive urail-alive--' + side + '">' + alive + '</span>' +
      pill('smokegrenade', counts.smoke) +
      pill('flashbang', counts.flash) +
      pill('hegrenade', counts.he) +
      pill('molotov', counts.moly);
  }

  /* ══════════ HIGH-PRECISION RADAR INTERPOLATOR (TIER-1 SMOOTHING) ══════════ */
  var posHistory = new Map();
  var animFrameRequested = false;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function updateSmoothPositions() {
    animFrameRequested = false;
    var now = performance.now();
    var hasActive = false;

    posHistory.forEach(function (state, id) {
      if (!state.el || !state.el.parentNode) {
        posHistory.delete(id);
        return;
      }
      var dt = (now - state.lastUpdate) / 1000;
      var factor = 1 - Math.exp(-dt * 22);
      if (factor > 1) factor = 1;

      state.currentX = lerp(state.currentX, state.targetX, factor);
      state.currentY = lerp(state.currentY, state.targetY, factor);
      state.lastUpdate = now;

      state.el.style.left = state.currentX.toFixed(2) + '%';
      state.el.style.top = state.currentY.toFixed(2) + '%';

      var dx = Math.abs(state.targetX - state.currentX);
      var dy = Math.abs(state.targetY - state.currentY);
      if (dx > 0.05 || dy > 0.05) {
        hasActive = true;
      }
    });

    if (hasActive) {
      requestAnimationFrame(updateSmoothPositions);
      animFrameRequested = true;
    }
  }

  function setSmoothPos(id, el, targetX, targetY) {
    var state = posHistory.get(id);
    var now = performance.now();
    if (!state) {
      state = { el: el, currentX: targetX, currentY: targetY, targetX: targetX, targetY: targetY, lastUpdate: now };
      posHistory.set(id, state);
      el.style.left = targetX.toFixed(2) + '%';
      el.style.top = targetY.toFixed(2) + '%';
    } else {
      state.el = el;
      var dist = Math.hypot(targetX - state.currentX, targetY - state.currentY);
      if (dist > 25) {
        state.currentX = targetX;
        state.currentY = targetY;
      }
      state.targetX = targetX;
      state.targetY = targetY;
      state.lastUpdate = now;
    }

    if (!animFrameRequested) {
      animFrameRequested = true;
      requestAnimationFrame(updateSmoothPositions);
    }
  }

  function removeSmoothPos(id) {
    posHistory.delete(id);
  }

  function renderRadar(ctx) {
    var cfg = ctx.radarCfg;
    if ((ctx.options && ctx.options.radar === false) || !cfg || !ctx.snap.players.length) {
      show($('scope'), false);
      return;
    }
    show($('scope'), true);
    C.radarArt($('radar-img'), ctx.mapKey);
    $('scope-label').textContent = (ctx.snap.map || '').toUpperCase();

    var seen = new Set();
    ctx.snap.players.forEach(function (p) {
      seen.add(p.steamid);
      var d = dots.get(p.steamid);
      if (!d) {
        d = document.createElement('div');
        $('radar-dots').appendChild(d);
        dots.set(p.steamid, d);
      }
      var dead = p.health <= 0;
      var pos = C.radarPos(p, cfg);
      d.className = 'pip pip--' + String(p.team || '').toLowerCase() +
        (dead ? ' pip--dead' : '') +
        (p.steamid === ctx.snap.focused_steamid ? ' pip--live' : '') +
        (p.has_bomb ? ' pip--c4' : '');
      d.textContent = dead ? '' : C.formatSlot(p.observer_slot);
      if (pos && !dead) {
        d.style.display = '';
        setSmoothPos(p.steamid, d, pos.x, pos.y);
      } else {
        d.style.display = 'none';
        removeSmoothPos(p.steamid);
      }
    });
    dots.forEach(function (d, id) {
      if (!seen.has(id)) {
        d.remove();
        dots.delete(id);
        removeSmoothPos(id);
      }
    });
    var bombPos = (ctx.snap.bomb_x != null && ctx.snap.bomb_y != null && (ctx.snap.bomb_x !== 0 || ctx.snap.bomb_y !== 0))
      ? C.radarPos({ pos_x: ctx.snap.bomb_x, pos_y: ctx.snap.bomb_y }, cfg)
      : null;
    var bEl = $('radar-bomb');
    if (bEl) {
      var isPlanted = ctx.snap.bomb_state === 'planted' || ctx.snap.bomb === 'planted';
      var isDropped = ctx.snap.bomb_state === 'dropped';
      var showBomb = (isPlanted || isDropped) && !!bombPos;
      show(bEl, showBomb);
      if (bombPos && showBomb) {
        setSmoothPos('__bomb__', bEl, bombPos.x, bombPos.y);
      } else {
        removeSmoothPos('__bomb__');
      }
    }
  }

  function renderDossier(ctx) {
    var f = ctx.focused;
    var camInner = $('cam-inner');
    C.mountCamera(camInner, f, ctx.liveCam);
    var cs = $('cam-slot');
    if (cs && camInner) {
      cs.dataset.sid = camInner.dataset.sid || '';
      cs.dataset.cameraState = camInner.dataset.cameraState || '';
    }

    show($('dossier'), !!f);
    if (!f) {
      var dEl = $('dossier');
      if (dEl) dEl.classList.remove('is-cam');
      return;
    }
    var ct = String(f.team || '').toUpperCase() === 'CT';
    var d = $('dossier');
    d.classList.toggle('is-ct', ct);
    d.classList.toggle('is-t', !ct);
    d.classList.toggle('is-cam', !!ctx.liveCam || ctx.options.avatars !== false);
    camInner.style.backgroundImage = !ctx.liveCam && ctx.options.avatars !== false ? 'url(assets/agents-' + (ct ? 'ct' : 't') + '.png)' : 'none';

    $('op-slot').textContent = C.formatSlot(f.observer_slot);
    $('op-name').textContent = f.name || '';
    $('op-hp').textContent = f.health || 0;
    $('op-ar').textContent = f.armor || 0;
    $('op-hp-bar').style.width = Math.max(0, Math.min(100, f.health)) + '%';
    $('op-ar-bar').style.width = Math.max(0, Math.min(100, f.armor)) + '%';
    $('op-ammo').textContent = f.ammo_clip != null ? f.ammo_clip : 0;
    $('op-reserve').textContent = '/' + (f.ammo_reserve != null ? f.ammo_reserve : 0);
    $('op-ladder').innerHTML = ladder(f.ammo_clip || 0, 30);
    $('op-k').textContent = f.kills || 0;
    $('op-a').textContent = f.assists || 0;
    $('op-d').textContent = f.deaths || 0;
    $('op-adr').textContent = f.adr || 0;
    $('op-gun').innerHTML = f.weapon
      ? '<img src="assets/weapons/' + esc(f.weapon) + '.svg" alt="">' : '';
    $('op-kit').innerHTML =
      ((f.grenades || []).map(function (g) { return '<i class="ux nade-' + esc(g) + '"></i>'; }).join('')) +
      (f.defusekit && ct ? '<i class="ux ux--kit"></i>' : '') +
      (f.has_bomb ? '<i class="ux ux--bomb"></i>' : '');
  }

  function render(ctx) {
    var s = ctx.snap;
    var showMoney = !!(ctx.options && ctx.options.economy);

    show($('pods'), true);
    $('ct-name').textContent = s.ct_name || 'CT';
    $('t-name').textContent = s.t_name || 'T';
    $('ct-score').textContent = s.ct_score || 0;
    $('t-score').textContent = s.t_score || 0;
    $('clock').textContent = clockText(s.round_time);

    var matchType = String(s.series_match_type || 'bo3').toLowerCase();
    var needed = matchType === 'bo5' ? 3 : matchType === 'bo1' ? 1 : 2;
    var ctMaps = Number(s.series_left_score) || 0;
    var tMaps = Number(s.series_right_score) || 0;
    var currentMap = Math.min(needed * 2 - 1, ctMaps + tMaps + 1);

    var pickTag = s.map_pick_tag || '';
    if (!pickTag) {
      if ((matchType === 'bo3' && currentMap === 3) || (matchType === 'bo5' && currentMap === 5) || matchType === 'bo1') {
        pickTag = 'DECIDER';
      }
    }

    var seriesStateEl = $('series-state');
    if (seriesStateEl) {
      var sText = matchType.toUpperCase() + ' · MAP ' + currentMap;
      if (pickTag) sText += ' · ' + pickTag;
      if (s.tournament_name) sText = s.tournament_name + ' · ' + sText;
      seriesStateEl.textContent = sText;
    }

    var ctPickEl = $('ct-pick');
    var tPickEl = $('t-pick');
    if (ctPickEl && tPickEl) {
      var isDecider = pickTag === 'DECIDER';
      var ctIsPick = false;
      var tIsPick = false;
      if (!isDecider && pickTag) {
        var ctNameUpper = (s.ct_name || '').toUpperCase();
        var tNameUpper = (s.t_name || '').toUpperCase();
        if (ctNameUpper && pickTag.toUpperCase().indexOf(ctNameUpper) >= 0) {
          ctIsPick = true;
        } else if (tNameUpper && pickTag.toUpperCase().indexOf(tNameUpper) >= 0) {
          tIsPick = true;
        } else if (pickTag === 'PICK') {
          if (currentMap === 1) {
            ctIsPick = (s.match_left_name && ctNameUpper === s.match_left_name.toUpperCase()) || (!s.match_left_name);
            tIsPick = !ctIsPick;
          } else if (currentMap === 2) {
            tIsPick = (s.match_right_name && tNameUpper === s.match_right_name.toUpperCase()) || (!s.match_right_name);
            ctIsPick = !tIsPick;
          }
        }
      }
      ctPickEl.classList.toggle('hidden', !ctIsPick);
      tPickEl.classList.toggle('hidden', !tIsPick);
    }

    function renderPips(el, won, total) {
      if (!el) return;
      if (total <= 1) { el.innerHTML = ''; return; }
      var h = '';
      for (var i = 0; i < total; i++) {
        h += '<i class="' + (i < won ? 'is-won' : '') + '"></i>';
      }
      el.innerHTML = h;
    }
    renderPips($('ct-series'), ctMaps, needed);
    renderPips($('t-series'), tMaps, needed);

    var phase = String(s.phase_countdown_phase || s.phase || '').toLowerCase();
    var phaseLabel = 'ROUND ' + (s.round || 1);
    if (phase === 'freezetime') phaseLabel = 'BUY TIME';
    else if (phase === 'warmup') phaseLabel = 'WARMUP';
    else if (phase === 'over') phaseLabel = 'ROUND OVER';
    else if (phase === 'halftime') phaseLabel = 'HALF TIME';
    else if (phase === 'gameover') phaseLabel = 'MATCH OVER';
    $('round-state').textContent = phaseLabel;

    var planted = (s.bomb_state || '') === 'planted' || phase === 'bomb';
    var bombEl = $('bomb-timer');
    if (bombEl) {
      show(bombEl, planted);
      if (planted) {
        var rawLeft = Number(s.bomb_countdown);
        var known = s.bomb_countdown != null && s.bomb_countdown !== '' && Number.isFinite(rawLeft);
        if (known) {
          var left = Math.max(0, Math.floor(rawLeft));
          bombEl.innerHTML = '<b>' + left + '</b><i style="width:' + (left / 40 * 100) + '%"></i>';
          bombEl.className = 'rail-bomb' + (left <= 10 ? ' c4-crit' : left <= 20 ? ' c4-warn' : ' c4-safe');
        } else {
          bombEl.innerHTML = '<b>--</b><i style="width:0%"></i>';
          bombEl.className = 'rail-bomb';
        }
      }
    }
    show($('clock'), !planted);

    var timeoutBar = $('timeout-bar');
    if (timeoutBar) {
      var isTimeoutCt = phase === 'timeout_ct';
      var isTimeoutT = phase === 'timeout_t';
      var isTechPause = phase === 'paused';
      var showTimeout = isTimeoutCt || isTimeoutT || isTechPause;
      show(timeoutBar, showTimeout);
      if (showTimeout) {
        var titleEl = $('timeout-title');
        var countEl = $('timeout-count');
        if (isTimeoutCt) {
          if (titleEl) titleEl.textContent = (s.ct_name || 'CT') + ' TIMEOUT';
          var ctRem = s.ct_timeouts_remaining;
          if (countEl) countEl.textContent = ctRem != null && ctRem !== '' ? ctRem + ' REMAINING' : '';
        } else if (isTimeoutT) {
          if (titleEl) titleEl.textContent = (s.t_name || 'T') + ' TIMEOUT';
          var tRem = s.t_timeouts_remaining;
          if (countEl) countEl.textContent = tRem != null && tRem !== '' ? tRem + ' REMAINING' : '';
        } else {
          if (titleEl) titleEl.textContent = 'TECHNICAL PAUSE';
          if (countEl) countEl.textContent = 'ADMIN';
        }
      }
    }

    var rail = $('round-rail');
    if (rail.childElementCount !== 24) {
      var h = '';
      for (var i = 0; i < 24; i++) h += '<i></i>';
      rail.innerHTML = h;
    }
    [].forEach.call(rail.children, function (el, i) {
      el.className = i < (s.round || 0) ? 'is-done' : '';
    });

    $('ct-cols').innerHTML = ctx.ct.map(function (p) {
      return columnHtml(p, 'ct', s.focused_steamid, showMoney);
    }).join('');
    $('t-cols').innerHTML = ctx.t.map(function (p) {
      return columnHtml(p, 't', s.focused_steamid, showMoney);
    }).join('');

    document.querySelectorAll('.col-name').forEach(function (el) {
      var size = 1.8; el.style.fontSize = size + 'rem';
      while (el.scrollWidth > el.clientWidth && size > 1.6) {
        size -= 0.05;
        el.style.fontSize = size.toFixed(2) + 'rem';
      }
    });

    show($('urail'), true);
    $('ct-util').innerHTML = utilHtml(ctx.ct, 'ct');
    $('t-util').innerHTML = utilHtml(ctx.t, 't');

    renderRadar(ctx);
    renderDossier(ctx);
  }

  C.start(render);
})();
