/* PROTOKOL CYBER — vertical tactical HUD.
   Own renderer: emits HP columns, an ammo ladder and a dossier panel.
   Shares only the WS feed and radar math via ProtokolCore. */
(function () {
  'use strict';
  var C = window.ProtokolCore;
  var $ = function (id) { return document.getElementById(id); };
  var esc = C.esc;

  var dots = new Map();

  function show(el, on) { if (el) el.classList.toggle('hidden', !on); }

  /* ── Vertical HP column per player ─────────────────────────────
     Each player is a tall bar; health drains from the top down, so a
     wounded team reads as a skyline at a glance. */
  function columnHtml(p, side, focusedId) {
    var hp = Math.max(0, Math.min(100, p.health));
    var dead = hp <= 0;
    var util = (p.grenades || []).slice(0, 3).map(function (g) {
      return '<i class="ux nade-' + esc(g) + '"></i>';
    }).join('');

    return '' +
      '<div class="col' + (dead ? ' col--dead' : '') +
        (p.steamid === focusedId ? ' col--live' : '') + '" data-sid="' + esc(p.steamid) + '">' +
        '<div class="col-slot">' + (p.observer_slot || '') + '</div>' +
        '<div class="col-bar">' +
          '<div class="col-fill col-fill--' + side + '" style="height:' + hp + '%"></div>' +
          '<span class="col-hp">' + (dead ? '✕' : hp) + '</span>' +
        '</div>' +
        '<div class="col-body">' +
          '<div class="col-name">' + esc(p.name) + '</div>' +
          '<div class="col-sub">' +
            '<span class="col-kd"><b>' + (p.kills || 0) + '</b>/' + (p.deaths || 0) + '</span>' +
            '<span class="col-cash">$' + (p.money || 0) + '</span>' +
          '</div>' +
          '<div class="col-util">' + util +
            (p.has_bomb ? '<i class="ux ux--bomb"></i>' : '') +
            (p.armor > 0 ? '<i class="ux ux--' + (p.helmet ? 'helm' : 'vest') + '"></i>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ── Team utility rail ── */
  function utilHtml(players, side) {
    var types = ['smokegrenade', 'flashbang', 'hegrenade', 'molotov'];
    var n = {};
    types.forEach(function (t) { n[t] = 0; });
    players.forEach(function (p) {
      (p.grenades || []).forEach(function (g) {
        var k = g === 'incgrenade' ? 'molotov' : g;
        if (n[k] !== undefined) n[k] += 1;
      });
    });
    var alive = players.filter(function (p) { return p.health > 0; }).length;
    return '<span class="urail-alive urail-alive--' + side + '">' + alive + '</span>' +
      types.map(function (t) {
        return '<span class="ucount' + (n[t] ? ' is-on' : '') + '">' +
          '<i class="ux nade-' + t + '"></i>' + n[t] + '</span>';
      }).join('');
  }

  /* ── Segmented ammo ladder: one notch per round in the magazine ── */
  function ladder(clip, max) {
    var m = max || 30, out = '';
    for (var i = 0; i < m; i++) {
      out += '<i class="notch' + (i < clip ? ' is-live' : '') + '"></i>';
    }
    return out;
  }

  function renderRadar(ctx) {
    var cfg = ctx.radarCfg;
    if (!cfg || !ctx.snap.players.length) { show($('scope'), false); return; }
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
        (p.steamid === ctx.snap.focused_steamid ? ' pip--live' : '');
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

  function renderDossier(ctx) {
    var f = ctx.focused;
    show($('dossier'), !!f);
    if (!f) return;
    var ct = String(f.team || '').toUpperCase() === 'CT';
    var d = $('dossier');
    d.classList.toggle('is-ct', ct);
    d.classList.toggle('is-t', !ct);
    d.classList.toggle('is-cam', ctx.liveCam);

    $('op-slot').textContent = f.observer_slot || '';
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
    $('cam-inner').setAttribute('data-sid', f.steamid || '');
  }

  function render(ctx) {
    var s = ctx.snap;

    show($('pods'), true);
    $('ct-name').textContent = s.ct_name || 'CT';
    $('t-name').textContent = s.t_name || 'T';
    $('ct-score').textContent = s.ct_score || 0;
    $('t-score').textContent = s.t_score || 0;
    $('clock').textContent = s.round_time || '0:00';
    $('round-state').textContent = 'ROUND ' + (s.round || 1);

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
      return columnHtml(p, 'ct', s.focused_steamid);
    }).join('');
    $('t-cols').innerHTML = ctx.t.map(function (p) {
      return columnHtml(p, 't', s.focused_steamid);
    }).join('');

    show($('urail'), true);
    $('ct-util').innerHTML = utilHtml(ctx.ct, 'ct');
    $('t-util').innerHTML = utilHtml(ctx.t, 't');

    renderRadar(ctx);
    renderDossier(ctx);
  }

  C.start(render);
})();
