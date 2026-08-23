/* OpenHUD "broadcast-light" pack: clean light pro style (ESL/IEM vibe) with webcam. */
(function () {
  'use strict';
  var loc = window.location;
  var proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  var WS_URL = proto + '//' + loc.host + '/ws';

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    topbar: $('topbar'), ctName: $('ct-name'), tName: $('t-name'),
    ctScore: $('ct-score'), tScore: $('t-score'),
    timer: $('timer'), roundLabel: $('round-label'),
    ctList: $('ct-list'), tList: $('t-list'),
    camWrap: $('cam-wrap'), camName: $('cam-name'), camTeam: $('cam-team'),
    camStats: $('cam-stats'),
  };

  var state = { sidesReversed: false };

  function fmtMoney(m) {
    return m >= 1000 ? '$' + Math.round(m / 1000) * 1000 : '$' + m;
  }

  function playerRow(p, side) {
    var dead = p.health <= 0;
    var hpPct = Math.max(0, p.health);
    var hpColor = hpPct > 60 ? '#2fbf71' : hpPct > 25 ? '#f5a623' : '#e2504f';
    return '<div class="prow ' + (dead ? 'is-dead' : '') + '">' +
      '<div class="prow-name">' + p.name + '</div>' +
      '<div class="prow-kd">' + p.kills + '<i>/</i>' + p.deaths + '</div>' +
      '<div class="prow-money">' + fmtMoney(p.money) + '</div>' +
      '<div class="prow-hp"><i style="width:' + hpPct + '%;background:' + hpColor + '"></i></div>' +
      '</div>';
  }

  function focusedPlayer(snap) {
    if (!snap.focused_steamid) return null;
    for (var i = 0; i < snap.players.length; i++) {
      if (snap.players[i].steamid === snap.focused_steamid) return snap.players[i];
    }
    // Fallback: first alive player so the frame still shows someone.
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
    els.roundLabel.textContent = snap.round > 0 ? 'ROUND ' + snap.round : '';
    els.timer.textContent = snap.phase === 'live' ? (snap.round_time || '') :
      (snap.phase === 'over' ? '—' : '');

    els.ctList.innerHTML = left.map(p => playerRow(p)).join('');
    els.tList.innerHTML = right.map(p => playerRow(p)).join('');

    var f = focusedPlayer(snap);
    if (f) {
      els.camWrap.classList.add('visible');
      els.camName.textContent = f.name;
      els.camTeam.textContent = f.team === 'CT'
        ? (state.sidesReversed ? snap.t_name : snap.ct_name)
        : (state.sidesReversed ? snap.ct_name : snap.t_name);
      els.camTeam.className = 'cam-team team-' + f.team.toLowerCase();
      els.camStats.innerHTML =
        '<span class="stat-hp">' + Math.max(0, f.health) + '</span>' +
        '<span>' + f.kills + '-' + f.deaths + '-' + f.assists + '</span>' +
        '<span class="stat-money">' + fmtMoney(f.money) + '</span>';
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
