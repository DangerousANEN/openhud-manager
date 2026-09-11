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

  /* ── One table ROW per player (a stat sheet, not a card) ── */
  function rowHtml(p, side, focusedId) {
    var hp = Math.max(0, Math.min(100, p.health));
    var dead = hp <= 0;
    var kit = (p.armor > 0
        ? '<i class="ux ux--' + (p.helmet ? 'helm' : 'vest') + '"></i>' : '') +
      (p.defusekit && side === 'ct' ? '<i class="ux ux--kit"></i>' : '') +
      (p.has_bomb ? '<i class="ux ux--bomb"></i>' : '') +
      (p.grenades || []).slice(0, 4).map(function (g) {
        return '<i class="ux nade-' + esc(g) + '"></i>';
      }).join('');

    return '' +
      '<div class="row' + (dead ? ' row--out' : '') +
        (p.steamid === focusedId ? ' row--on' : '') + '">' +
        '<span class="rc rc--tag"><i class="tick tick--' + side + '"></i></span>' +
        '<span class="rc rc--num">' + (p.observer_slot || '') + '</span>' +
        '<span class="rc rc--name">' + esc(p.name) + '</span>' +
        '<span class="rc rc--hp">' +
          '<i class="hpbar"><b class="hpbar-fill hpbar-fill--' + side +
            '" style="width:' + hp + '%"></b></i>' +
          '<u>' + (dead ? '—' : hp) + '</u>' +
        '</span>' +
        '<span class="rc rc--kda">' + (p.kills || 0) + '<s>–</s>' +
          (p.assists || 0) + '<s>–</s>' + (p.deaths || 0) + '</span>' +
        '<span class="rc rc--adr">' + (p.adr || 0) + '</span>' +
        '<span class="rc rc--eq">' + kit + '</span>' +
      '</div>';
  }

  function renderRadar(ctx) {
    var cfg = ctx.radarCfg;
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
        (p.steamid === ctx.snap.focused_steamid ? ' blip--on' : '');
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

  function renderStrap(ctx) {
    var f = ctx.focused;
    show($('strap'), !!f);
    if (!f) return;
    var ct = String(f.team || '').toUpperCase() === 'CT';
    var s = $('strap');
    s.classList.toggle('is-ct', ct);
    s.classList.toggle('is-t', !ct);
    s.classList.toggle('is-cam', ctx.liveCam);

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

  function money(players) {
    return players.reduce(function (a, p) { return a + (p.money || 0); }, 0);
  }

  function render(ctx) {
    var s = ctx.snap;

    show($('bug'), true);
    show($('econ'), true);
    $('ct-name').textContent = s.ct_name || 'CT';
    $('t-name').textContent = s.t_name || 'T';
    $('ct-score').textContent = s.ct_score || 0;
    $('t-score').textContent = s.t_score || 0;
    $('clock').textContent = s.round_time || '0:00';
    $('round-state').textContent = 'RD ' + (s.round || 1);
    $('ct-head').textContent = s.ct_name || 'CT';
    $('t-head').textContent = s.t_name || 'T';
    $('ct-econ').textContent = '$' + money(ctx.ct);
    $('t-econ').textContent = '$' + money(ctx.t);

    var flow = $('round-flow');
    if (flow.childElementCount !== 24) {
      var h = '';
      for (var i = 0; i < 24; i++) h += '<i></i>';
      flow.innerHTML = h;
    }
    [].forEach.call(flow.children, function (el, i) {
      el.className = i < (s.round || 0) ? 'is-played' : '';
    });

    $('ct-rows').innerHTML = ctx.ct.map(function (p) {
      return rowHtml(p, 'ct', s.focused_steamid);
    }).join('');
    $('t-rows').innerHTML = ctx.t.map(function (p) {
      return rowHtml(p, 't', s.focused_steamid);
    }).join('');

    renderRadar(ctx);
    renderStrap(ctx);
  }

  C.start(render);
})();
