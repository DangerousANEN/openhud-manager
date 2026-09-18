/* PROTOKOL CHAMPIONSHIP — arena ceremony HUD.
   Own renderer: emits SVG radial dials and stacked podium plinths (no bars, no generic cards).
   Shares only the WS feed + radar math via ProtokolCore. */
(function () {
  'use strict';
  var C = window.ProtokolCore;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc;
  var dots = new Map();

  var R = 18;
  var CIRC = 2 * Math.PI * R;   /* dial circumference for stroke-dashoffset */

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

  function ring(el, pct) {
    if (!el) return;
    var v = Math.max(0, Math.min(100, pct || 0));
    el.style.strokeDasharray = CIRC.toFixed(2);
    el.style.strokeDashoffset = (CIRC * (1 - v / 100)).toFixed(2);
  }

  /* ── One stacked podium plinth row per player, with radial HP dial ── */
  function plinthHtml(p, side, focusedId, showMoney) {
    var hp = Math.max(0, Math.min(100, p.health));
    var dead = hp <= 0;
    var off = (CIRC * (1 - hp / 100)).toFixed(2);

    var kitHtml =
      (p.armor > 0 ? '<i class="ux ux--' + (p.helmet ? 'helm' : 'vest') + '"></i>' : '') +
      (p.defusekit && side === 'ct' ? '<i class="ux ux--kit"></i>' : '') +
      (p.has_bomb ? '<i class="ux ux--bomb"></i>' : '') +
      (p.grenades || []).slice(0, 4).map(function (g) {
        return '<i class="ux nade-' + esc(g) + '"></i>';
      }).join('');

    var gunHtml = (p.weapon && !dead)
      ? '<img src="assets/weapons/' + esc(p.weapon) + '.svg" alt="">'
      : '';

    return '' +
      '<div class="plinth' + (dead ? ' plinth--out' : '') +
        (p.steamid === focusedId ? ' plinth--on' : '') + '">' +
        '<span class="plinth-slot">' + C.formatSlot(p.observer_slot) + '</span>' +
        '<div class="plinth-dial-wrap">' +
          '<svg class="pdial" viewBox="0 0 44 44" aria-hidden="true">' +
            '<circle class="pdial-bg" cx="22" cy="22" r="' + R + '"></circle>' +
            '<circle class="pdial-fg pdial-fg--' + side + '" cx="22" cy="22" r="' + R + '"' +
              ' style="stroke-dasharray:' + CIRC.toFixed(2) + ';stroke-dashoffset:' + (dead ? CIRC.toFixed(2) : off) + '"></circle>' +
          '</svg>' +
          '<span class="pdial-num">' + (dead ? '✕' : hp) + '</span>' +
        '</div>' +
        '<span class="plinth-name">' + esc(p.name) + '</span>' +
        '<span class="plinth-gun">' + gunHtml + '</span>' +
        '<div class="plinth-kd">' +
          '<b class="pk-k">' + (p.kills || 0) + '</b>' +
          '<s>/</s>' +
          '<b class="pk-d">' + (p.deaths || 0) + '</b>' +
        '</div>' +
        '<span class="plinth-cash' + (showMoney ? '' : ' hidden') + '">$' + (p.money || 0) + '</span>' +
        '<span class="plinth-kit">' + kitHtml + '</span>' +
      '</div>';
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

  /* ══════════ TIER-1 BROADCAST RADAR INTERPOLATOR ══════════
     Maintains a jitter-buffered sample history per entity and continuously
     evaluates Catmull-Rom spline positions at 60/144 FPS in requestAnimationFrame.
  */
  var RadarTracker = (function () {
    var entities = new Map(); // id -> { el, samples: [{t, x, y}], avgInterval }
    var rafActive = false;

    function push(id, el, targetX, targetY) {
      var now = performance.now();
      var state = entities.get(id);
      if (!state) {
        state = {
          el: el,
          samples: [{ t: now, x: targetX, y: targetY }],
          avgInterval: 280
        };
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
      // Detect map teleport / respawn
      var dist = Math.hypot(targetX - last.x, targetY - last.y);
      if (dist > 25) {
        state.samples = [{ t: now, x: targetX, y: targetY }];
      } else {
        state.samples.push({ t: now, x: targetX, y: targetY });
        // Prune old samples (> 2.5s)
        while (state.samples.length > 2 && state.samples[0].t < (now - 2500)) {
          state.samples.shift();
        }
      }
      startLoop();
    }

    function remove(id) {
      entities.delete(id);
    }

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

        // Tier-1 delay buffer: smooth playback across GSI jitter
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
          // Spline segment lookup
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

      if (activeCount > 0) {
        requestAnimationFrame(tick);
      } else {
        rafActive = false;
      }
    }

    return {
      push: push,
      remove: remove
    };
  })();

  function renderRadar(ctx) {
    var cfg = ctx.options.radar === false ? null : ctx.radarCfg;
    if (!cfg || !ctx.snap.players.length) { show($('plate'), false); return; }
    show($('plate'), true);
    C.radarArt($('radar-img'), ctx.mapKey);
    $('plate-name').textContent = (ctx.snap.map || '').toUpperCase();

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
      d.className = 'medal medal--' + String(p.team || '').toLowerCase() +
        (dead ? ' medal--out' : '') +
        (p.steamid === ctx.snap.focused_steamid ? ' medal--on' : '') +
        (p.has_bomb ? ' medal--c4' : '');
      d.textContent = dead ? '' : C.formatSlot(p.observer_slot);
      if (pos && !dead) {
        d.style.display = '';
        RadarTracker.push(p.steamid, d, pos.x, pos.y);
      } else {
        d.style.display = 'none';
        RadarTracker.remove(p.steamid);
      }
    });
    dots.forEach(function (d, id) {
      if (!seen.has(id)) {
        d.remove();
        dots.delete(id);
        RadarTracker.remove(id);
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
        RadarTracker.push('__bomb__', bEl, bombPos.x, bombPos.y);
      } else {
        RadarTracker.remove('__bomb__');
      }
    }
  }

  function renderSpotlight(ctx) {
    var f = ctx.focused;
    show($('spotlight'), !!f);
    C.mountCamera($('cam-inner'), f, ctx.liveCam);
    if (!f) return;
    var ct = String(f.team || '').toUpperCase() === 'CT';
    var s = $('spotlight');
    s.classList.toggle('is-ct', ct);
    s.classList.toggle('is-t', !ct);
    s.classList.toggle('is-cam', !!ctx.liveCam || ctx.options.avatars !== false);
    $('cam-inner').style.backgroundImage = !ctx.liveCam && ctx.options.avatars !== false ? 'url(assets/agents-' + (ct ? 'ct' : 't') + '.png)' : 'none';

    $('op-slot').textContent = C.formatSlot(f.observer_slot);
    $('op-name').textContent = f.name || '';
    $('op-team').textContent = ct
      ? (ctx.snap.ct_name || 'CT') : (ctx.snap.t_name || 'T');
    $('op-hp').textContent = f.health || 0;
    $('op-ar').textContent = f.armor || 0;
    ring($('op-hp-ring'), f.health);
    ring($('op-ar-ring'), f.armor);
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

  function render(ctx) {
    var s = ctx.snap;
    var showMoney = !!(ctx.options && ctx.options.economy);

    show($('crest'), true);
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

    var planted = (s.bomb_state || '') === 'planted' || (s.bomb_state || '') === 'defusing' || phase === 'bomb';
    var bombEl = $('bomb-timer');
    if (bombEl) {
      show(bombEl, planted);
      if (planted) {
        var rawStr = (s.bomb_countdown != null && s.bomb_countdown !== '') ? s.bomb_countdown : (phase === 'bomb' ? s.round_time : '');
        var rawLeft = Number(rawStr);
        var known = Number.isFinite(rawLeft) && rawLeft > 0;
        var isDefusing = s.bomb_state === 'defusing';
        if (known) {
          var left = Math.max(0, Math.floor(rawLeft));
          var pct = Math.min(100, Math.max(0, (rawLeft / 40) * 100));
          bombEl.innerHTML = '<b>' + (isDefusing ? 'DEFUSE ' : '') + left + '</b><i style="width:' + pct.toFixed(1) + '%"></i>';
          bombEl.className = 'crest-bomb' + (isDefusing ? ' c4-defuse' : (left <= 10 ? ' c4-crit' : left <= 20 ? ' c4-warn' : ' c4-safe'));
        } else {
          bombEl.innerHTML = '<b>' + (isDefusing ? 'DEFUSING' : 'C4') + '</b><i style="width:100%"></i>';
          bombEl.className = 'crest-bomb' + (isDefusing ? ' c4-defuse' : ' c4-crit');
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

    show($('tally'), true);
    $('ct-alive').textContent = ctx.ct.filter(function (p) { return p.health > 0; }).length;
    $('t-alive').textContent = ctx.t.filter(function (p) { return p.health > 0; }).length;

    var beads = $('round-beads');
    if (beads.childElementCount !== 24) {
      var h = '';
      for (var i = 0; i < 24; i++) h += '<i></i>';
      beads.innerHTML = h;
    }
    [].forEach.call(beads.children, function (el, i) {
      el.className = i < (s.round || 0) ? 'is-set' : '';
    });

    $('ct-podium').innerHTML = ctx.ct.map(function (p) {
      return plinthHtml(p, 'ct', s.focused_steamid, showMoney);
    }).join('');
    $('t-podium').innerHTML = ctx.t.map(function (p) {
      return plinthHtml(p, 't', s.focused_steamid, showMoney);
    }).join('');

    document.querySelectorAll('.plinth-name').forEach(function (el) {
      var size = 1.7; el.style.fontSize = size + 'rem';
      while (el.scrollWidth > el.clientWidth && size > 1.6) {
        size -= 0.05;
        el.style.fontSize = size.toFixed(2) + 'rem';
      }
    });
    renderRadar(ctx);
    renderSpotlight(ctx);
  }

  C.start(render);
})();
