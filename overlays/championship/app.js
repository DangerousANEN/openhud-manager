/* OpenHUD "championship" pack: dark neon pro-style HUD with webcam frame. */
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
    aliveCt: $('alive-ct'), aliveT: $('alive-t'),
    camWrap: $('cam-wrap'), camName: $('cam-name'), camTeam: $('cam-team'),
    camStats: $('cam-stats'), camPlaceholder: $('cam-placeholder'),
    bombBanner: $('bomb-banner'),
  };

  var state = { sidesReversed: false };

  function fmtMoney(m) {
    return m >= 1000 ? '$' + (m / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : '$' + m;
  }

  function playerRow(p, side) {
    var dead = p.health <= 0;
    return '<div class="prow ' + (dead ? 'is-dead' : '') + '">' +
      '<div class="prow-slot">' + (p.observer_slot || '') + '</div>' +
      '<div class="prow-name">' + p.name + '</div>' +
      '<div class="prow-kd">' + p.kills + '/' + p.deaths + '</div>' +
      '<div class="prow-money">' + fmtMoney(p.money) + '</div>' +
      '<div class="prow-hp"><i style="width:' + Math.max(0, p.health) + '%"></i></div>' +
      '</div>';
  }

  function focusedPlayer(snap) {
    if (!snap.focused_steamid) return null;
    for (var i = 0; i < snap.players.length; i++) {
      if (snap.players[i].steamid === snap.focused_steamid) return snap.players[i];
    }
    return null;
  }

  function render(snap) {
    if (snap.players && snap.players.length) els.topbar.classList.remove('hidden');
    var ctPlayers = snap.players.filter(p => p.team === 'CT');
    var tPlayers = snap.players.filter(p => p.team === 'T');
    var left = state.sidesReversed ? tPlayers : ctPlayers;
    var right = state.sidesReversed ? ctPlayers : tPlayers;
    var leftName = state.sidesReversed ? snap.t_name : snap.ct_name;
    var rightName = state.sidesReversed ? snap.ct_name : snap.t_name;

    els.ctName.textContent = leftName;
    els.tName.textContent = rightName;
    els.ctScore.textContent = state.sidesReversed ? snap.t_score : snap.ct_score;
    els.tScore.textContent = state.sidesReversed ? snap.ct_score : snap.t_score;
    els.roundLabel.textContent = snap.round > 0 ? 'ROUND ' + snap.round : '';
    els.mapTag.textContent = (snap.map || '').toUpperCase();
    els.timer.textContent = snap.phase === 'live' ? (snap.round_time || '') :
      (snap.phase === 'over' ? 'ROUND END' : '');
    els.aliveCt.textContent = left.filter(p => p.health > 0).length;
    els.aliveT.textContent = right.filter(p => p.health > 0).length;

    els.ctList.innerHTML = left.map(p => playerRow(p)).join('');
    els.tList.innerHTML = right.map(p => playerRow(p)).join('');

    // Webcam follows the spectated player.
    var f = focusedPlayer(snap);
    if (f) {
      els.camWrap.classList.add('visible');
      els.camPlaceholder.classList.add('hidden');
      els.camName.textContent = f.name;
      els.camTeam.textContent = f.team === 'CT' ? leftName : rightName;
      els.camTeam.className = 'cam-team team-' + f.team.toLowerCase();
      els.camStats.innerHTML =
        '<span class="stat-hp">' + Math.max(0, f.health) + ' HP</span>' +
        '<span>' + f.kills + ' / ' + f.deaths + '</span>' +
        '<span>' + fmtMoney(f.money) + '</span>';
    } else {
      els.camWrap.classList.remove('visible');
      els.camPlaceholder.classList.remove('hidden');
    }

    // Bomb planted banner
    if (snap.bomb === 'planted') {
      els.bombBanner.classList.add('visible');
    } else {
      els.bombBanner.classList.remove('visible');
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
