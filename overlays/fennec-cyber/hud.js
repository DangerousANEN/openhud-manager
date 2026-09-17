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
        '<div class="col-slot">' + (p.observer_slot || '') + '</div>' +
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
    d.classList.toggle('is-cam', !!ctx.liveCam);

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
  }

  function render(ctx) {
    var s = ctx.snap;
    var showMoney = !!(ctx.options && ctx.options.economy);

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
