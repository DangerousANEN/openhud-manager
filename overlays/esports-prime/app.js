/* OpenHUD "esports-prime" pack: aggressive cyber style, skewed panels, webcam. */
(function () {
  'use strict';
  var loc = window.location;
  var proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  var WS_URL = proto + '//' + loc.host + '/ws';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    topbar: $('topbar'), ctName: $('ct-name'), tName: $('t-name'),
    ctScore: $('ct-score'), tScore: $('t-score'),
    timer: $('timer'), roundLabel: $('round-label'), mapTag: $('map-tag'),
    ctList: $('ct-list'), tList: $('t-list'),
    camWrap: $('cam-wrap'), camName: $('cam-name'), camTeam: $('cam-team'),
    camStats: $('cam-stats'), camSeries: $('cam-series'),
  };

  var state = { sidesReversed: false };

  function fmtMoney(m) {
    return '$' + (m >= 1000 ? (m / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : m);
  }

  function playerRow(p) {
    var dead = p.health <= 0;
    var hp = Math.max(0, p.health);
    return '<div class="prow' + (dead ? ' is-dead' : '') + '">' +
      '<div class="prow-cut"></div>' +
      '<div class="prow-slot">' + String(p.observer_slot || '').padStart(2, '0') + '</div>' +
      '<div class="prow-main"><div class="prow-name">' + p.name + '</div>' +
      '<div class="prow-hpbar"><i style="width:' + hp + '%"></i></div></div>' +
      '<div class="prow-kd">' + p.kills + ':' + p.deaths + '</div>' +
      '<div class="prow-money">' + fmtMoney(p.money) + '</div>' +
      '</div>';
  }

  function focusedPlayer(snap) {
    if (!snap.focused_steamid) return null;
    for (var i = 0; i < snap.players.length; i++) {
      if (snap.players[i].steamid === snap.focused_steamid) return snap.players[i];
    }
    for (var j = 0; j < snap.players.length; j++) {
      if (snap.players[j].health > 0) return snap.players[j];
    }
    return null;
  }

  function render(snap) {
    if (snap.players && snap.players.length) els.topbar.classList.remove('hidden');
    var ctPlayers = snap.players.filter(p => p.team === 'CT');
    var tPlayers = snap.players.filter(p => p.team === 'T');
    var left = state.sidesReversed ? tPlayers : ctPlayers;
    var right = state.sidesReversed ? ctPlayers : tPlayers;

    els.ctName.textContent = state.sidesReversed ? snap.t_name : snap.ct_name;
    els.tName.textContent = state.sidesReversed ? snap.ct_name : snap.t_name;
    els.ctScore.textContent = state.sidesReversed ? snap.t_score : snap.ct_score;
    els.tScore.textContent = state.sidesReversed ? snap.ct_score : snap.t_score;
    els.roundLabel.textContent = snap.round > 0 ? 'R' + snap.round : '';
    els.mapTag.textContent = (snap.map || '').replace('de_', '').toUpperCase();
    els.timer.textContent = snap.phase === 'live' ? (snap.round_time || '0:00') :
      (snap.phase === 'over' ? 'END' : '');

    els.ctList.innerHTML = left.map(playerRow).join('');
    els.tList.innerHTML = right.map(playerRow).join('');

    var f = focusedPlayer(snap);
    if (f) {
      els.camWrap.classList.add('visible');
      els.camName.textContent = f.name.toUpperCase();
      els.camTeam.textContent = f.team === 'CT'
        ? (state.sidesReversed ? snap.t_name : snap.ct_name)
        : (state.sidesReversed ? snap.ct_name : snap.t_name);
      els.camTeam.className = 'cam-team team-' + f.team.toLowerCase();
      els.camStats.innerHTML =
        '<span class="cs-hp">' + Math.max(0, f.health) + '</span>' +
        '<span>' + f.kills + ':' + f.deaths + '</span>' +
        '<span>' + fmtMoney(f.money) + '</span>';
    } else {
      els.camWrap.classList.remove('visible');
    }
  }

  function connect() {
    var ws = new WebSocket(WS_URL);
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (window.PROTOKOL_EVENTS && window.PROTOKOL_EVENTS.handle(msg)) return;
      render(msg);
    };
    ws.onclose = () => setTimeout(connect, 2000);
  }
  connect();

  fetch('/api/state').then(r => r.json()).then(render).catch(() => {});
})();
