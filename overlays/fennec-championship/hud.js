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
        '<span class="plinth-slot">' + (p.observer_slot || '') + '</span>' +
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
        (p.steamid === ctx.snap.focused_steamid ? ' medal--on' : '');
      d.textContent = dead ? '' : (p.observer_slot || '');
      if (pos && !dead) {
        d.style.display = '';
        d.style.left = pos.x + '%';
        d.style.top = pos.y + '%';
      } else d.style.display = 'none';
    });
    dots.forEach(function (d, id) {
      if (!seen.has(id)) { d.remove(); dots.delete(id); }
    });
    show($('radar-bomb'), ctx.snap.bomb === 'planted');
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

    $('op-slot').textContent = f.observer_slot || '';
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
    $('clock').textContent = s.round_time || '0:00';
    $('round-state').textContent = 'ROUND ' + (s.round || 1);

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
