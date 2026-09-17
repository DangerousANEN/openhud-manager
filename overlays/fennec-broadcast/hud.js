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
        '<span class="rc rc--num">' + (p.observer_slot || '') + '</span>' +
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
        var left = Math.max(0, Math.floor(Number(s.bomb_countdown) || 0));
        bombEl.innerHTML = '<b>' + left + '</b><i style="width:' + (left / 40 * 100) + '%"></i>';
        bombEl.className = 'bomb-timer' + (left <= 10 ? ' c4-crit' : left <= 20 ? ' c4-warn' : ' c4-safe');
      }
    }
    show($('clock'), !planted);

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
