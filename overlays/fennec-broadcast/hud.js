/* PROTOKOL BROADCAST — television scoreboard HUD.
   Own renderer: emits TABLE rows (not cards), an economy strip and a
   lower-third strap. Shares only the WS feed + radar math via ProtokolCore. */
(function () {
  'use strict';
  var C = window.ProtokolCore;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc;
  var dots = new Map();

  function show(el, on) { if (el) el.classList.toggle('hidden', !on); }

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
    if (!w) return '<span class="' + (cls || 'rc--gun') + '"></span>';
    var name = weaponName(w);
    return '<span class="' + (cls || 'rc--gun') + '" title="' + esc(name) + '">' +
      '<img class="gun-icon" src="assets/weapons/' + esc(w) + '.svg" alt="' + esc(name) + '" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline-block\';">' +
      '<span class="gun-fallback" style="display:none">' + esc(name) + '</span>' +
    '</span>';
  }

  /* ── One table ROW per player (a stat sheet, not a card) ── */
  function rowHtml(p, side, focusedId, showMoney) {
    var hp = Math.max(0, Math.min(100, p.health));
    var dead = hp <= 0;
    var kit = (p.armor > 0
        ? '<i class="ux ux--' + (p.helmet ? 'helm' : 'vest') + '"></i>' : '') +
      (p.defusekit && side === 'ct' ? '<i class="ux ux--kit"></i>' : '') +
      (p.has_bomb ? '<i class="ux ux--bomb"></i>' : '') +
      (p.grenades || []).slice(0, 4).map(function (g) {
        return '<i class="ux nade-' + esc(g) + '"></i>';
      }).join('');

    var gunHtml = !dead && p.weapon ? weaponHtml(p.weapon, 'rc--gun') : '<span class="rc--gun"></span>';

    return '' +
      '<div class="row' + (dead ? ' row--out' : '') +
        (p.steamid === focusedId ? ' row--on' : '') + '">' +
        '<span class="rc rc--tag"><i class="tick tick--' + side + '"></i></span>' +
        '<span class="rc rc--num">' + C.formatSlot(p.observer_slot) + '</span>' +
        '<span class="rc rc--name">' + esc(p.name) + '</span>' +
        gunHtml +
        '<span class="rc rc--hp">' +
          '<i class="hpbar"><b class="hpbar-fill hpbar-fill--' + side +
            '" style="width:' + hp + '%"></b></i>' +
          '<u>' + (dead ? '—' : hp) + '</u>' +
        '</span>' +
        '<span class="rc rc--kda">' + (p.kills || 0) + '<s>–</s>' +
          (p.assists || 0) + '<s>–</s>' + (p.deaths || 0) + '</span>' +
        '<span class="rc rc--adr">' + (p.adr || 0) + '</span>' +
        '<span class="rc rc--money' + (showMoney ? '' : ' hidden') + '">$' + (p.money || 0) + '</span>' +
        '<span class="rc rc--eq">' + kit + '</span>' +
      '</div>';
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
    var cfg = ctx.options.radar === false ? null : ctx.radarCfg;
    if (!cfg || !ctx.snap.players.length) { show($('inset'), false); return; }
    show($('inset'), true);
    C.radarArt($('radar-img'), ctx.mapKey);
    $('inset-map').textContent = (ctx.snap.map || '').toUpperCase();

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
      d.className = 'blip blip--' + String(p.team || '').toLowerCase() +
        (dead ? ' blip--out' : '') +
        (p.steamid === ctx.snap.focused_steamid ? ' blip--on' : '') +
        (p.has_bomb ? ' blip--c4' : '');
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

  function renderStrap(ctx) {
    var f = ctx.focused;
    show($('strap'), !!f);
    C.mountCamera($('cam-inner'), f, ctx.liveCam);
    if (!f) return;
    var ct = String(f.team || '').toUpperCase() === 'CT';
    var s = $('strap');
    s.classList.toggle('is-ct', ct);
    s.classList.toggle('is-t', !ct);
    s.classList.toggle('is-cam', !!ctx.liveCam || ctx.options.avatars !== false);
    $('cam-inner').style.backgroundImage = !ctx.liveCam && ctx.options.avatars !== false ? 'url(assets/agents-' + (ct ? 'ct' : 't') + '.png)' : 'none';

    $('op-team').textContent = ct
      ? (ctx.snap.ct_name || 'CT') : (ctx.snap.t_name || 'T');
    $('op-name').textContent = f.name || '';
    $('op-hp').textContent = f.health || 0;
    $('op-ar').textContent = f.armor || 0;
    $('op-ammo').textContent = f.ammo_clip != null ? f.ammo_clip : 0;
    $('op-reserve').textContent = '/' + (f.ammo_reserve != null ? f.ammo_reserve : 0);
    $('op-k').textContent = f.kills || 0;
    $('op-a').textContent = f.assists || 0;
    $('op-d').textContent = f.deaths || 0;
    $('op-adr').textContent = f.adr || 0;
    $('op-gun').innerHTML = f.weapon
      ? '<img src="assets/weapons/' + esc(f.weapon) + '.svg" alt="">' : '';
    $('op-kit').innerHTML =
      (f.grenades || []).map(function (g) {
        return '<i class="ux nade-' + esc(g) + '"></i>';
      }).join('') +
      (f.defusekit && ct ? '<i class="ux ux--kit"></i>' : '') +
      (f.has_bomb ? '<i class="ux ux--bomb"></i>' : '');
    $('cam-inner').setAttribute('data-sid', f.steamid || '');
  }

  // GSI countdowns may be numeric strings; never show raw decimals on air.
  function clockText(value) {
    if (typeof value === 'string' && /^\d+:\d{2}$/.test(value)) return value;
    if (value == null || value === '' || !Number.isFinite(Number(value))) return '--:--';
    var seconds = Math.max(0, Math.floor(Number(value)));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function money(players) {
    return players.reduce(function (a, p) { return a + (p.money || 0); }, 0);
  }

  function render(ctx) {
    var s = ctx.snap;
    var phase = s.phase_countdown_phase || s.phase || '';
    var phaseLabels = { freezetime: 'BUY TIME', live: 'LIVE', over: 'ROUND OVER',
      warmup: 'WARMUP', intermission: 'HALF TIME', gameover: 'MATCH OVER',
      paused: 'PAUSED', timeout_ct: 'CT TIMEOUT', timeout_t: 'T TIMEOUT', bomb: 'BOMB PLANTED' };
    var phaseLabel = phaseLabels[phase] || 'WAITING';
    var showMoney = !!(ctx.options && ctx.options.economy) && phase === 'freezetime';
    var ctAlive = ctx.ct.filter(function (p) { return p.health > 0; }).length;
    var tAlive = ctx.t.filter(function (p) { return p.health > 0; }).length;

    show($('bug'), true);
    show($('econ'), showMoney);
    $('ct-name').textContent = s.ct_name || 'CT';
    $('t-name').textContent = s.t_name || 'T';
    $('ct-score').textContent = s.ct_score || 0;
    $('t-score').textContent = s.t_score || 0;
    $('clock').textContent = clockText(s.round_time);
    $('round-state').textContent = 'R' + (s.round || 1) + ' · ' + phaseLabel;

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

    $('ct-head').textContent = s.ct_name || 'CT';
    $('t-head').textContent = s.t_name || 'T';
    $('ct-econ').textContent = '$' + money(ctx.ct);
    $('t-econ').textContent = '$' + money(ctx.t);

    var ctShM = $('ct-sh-money');
    if (ctShM) ctShM.classList.toggle('hidden', !showMoney);
    var tShM = $('t-sh-money');
    if (tShM) tShM.classList.toggle('hidden', !showMoney);

    var ctSheet = $('ct-sheet');
    if (ctSheet) ctSheet.classList.toggle('has-econ', showMoney);
    var tSheet = $('t-sheet');
    if (tSheet) tSheet.classList.toggle('has-econ', showMoney);

    var flow = $('round-flow');
    flow.textContent = ctAlive + ' CT  ·  ALIVE  ·  ' + tAlive + ' T';
    flow.className = 'alive-line';

    var planted = (s.bomb_state || '') === 'planted' || phase === 'bomb';
    var bombEl = $('bomb-timer');
    if (bombEl) {
      show(bombEl, planted);
      if (planted) {
        var rawLeft = Number(s.bomb_countdown);
        // Number('') === 0 in JS: a missing countdown must NOT render as "0"
        // (a fake detonation-imminent state on air). Show an honest "--".
        var known = s.bomb_countdown != null && s.bomb_countdown !== '' && Number.isFinite(rawLeft);
        if (known) {
          var left = Math.max(0, Math.floor(rawLeft));
          bombEl.innerHTML = '<b>' + left + '</b><i style="width:' + (left / 40 * 100) + '%"></i>';
          bombEl.className = 'bomb-timer' + (left <= 10 ? ' c4-crit' : left <= 20 ? ' c4-warn' : ' c4-safe');
        } else {
          bombEl.innerHTML = '<b>--</b><i style="width:0%"></i>';
          bombEl.className = 'bomb-timer';
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
        var teamEl = $('timeout-team');
        var titleEl = $('timeout-title');
        var remEl = $('timeout-remaining');
        if (isTimeoutCt) {
          timeoutBar.className = 'timeout-bar timeout--ct';
          if (teamEl) teamEl.textContent = s.ct_name || 'CT';
          if (titleEl) titleEl.textContent = 'TACTICAL TIMEOUT';
          var ctRem = s.ct_timeouts_remaining;
          if (remEl) remEl.textContent = ctRem != null && ctRem !== '' ? ctRem + ' REMAINING' : '';
        } else if (isTimeoutT) {
          timeoutBar.className = 'timeout-bar timeout--t';
          if (teamEl) teamEl.textContent = s.t_name || 'T';
          if (titleEl) titleEl.textContent = 'TACTICAL TIMEOUT';
          var tRem = s.t_timeouts_remaining;
          if (remEl) remEl.textContent = tRem != null && tRem !== '' ? tRem + ' REMAINING' : '';
        } else {
          timeoutBar.className = 'timeout-bar timeout--tech';
          if (teamEl) teamEl.textContent = 'MATCH';
          if (titleEl) titleEl.textContent = 'TECHNICAL PAUSE';
          if (remEl) remEl.textContent = 'ADMIN';
        }
      }
    }

    $('ct-rows').innerHTML = ctx.ct.map(function (p) {
      return rowHtml(p, 'ct', s.focused_steamid, showMoney);
    }).join('');
    $('t-rows').innerHTML = ctx.t.map(function (p) {
      return rowHtml(p, 't', s.focused_steamid, showMoney);
    }).join('');

    document.querySelectorAll('.rc--name').forEach(function (el) {
      var size = 1.8; el.style.fontSize = size + 'rem';
      while (el.scrollWidth > el.clientWidth && size > 1.6) {
        size -= 0.05;
        el.style.fontSize = size.toFixed(2) + 'rem';
      }
    });

    renderRadar(ctx);
    renderStrap(ctx);
  }

  C.start(render);
})();
