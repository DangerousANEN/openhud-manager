/* ════════════════════════════════════════════════════════════════
   OpenHUD COMPACT HUD — WebSocket data consumer
   Connects to the hosting server's /ws endpoint, renders the GSI snapshot
   ════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // Serve-side relative: the overlay is hosted by the same Axum server,
  // so reuse its host/port instead of hardcoding 1349 (works with port fallback).
  const WS_HOST = location.hostname || '127.0.0.1';
  const WS_PORT = location.port || '1349';
  const WS_URL = `ws://${WS_HOST}:${WS_PORT}/ws`;
  let ws = null;
  let reconnectDelay = 1000;
  let lastData = null;

  // Element refs
  const $ = (id) => document.getElementById(id);
  const els = {
    topbar: $('topbar'),
    ctName: $('ct-name'), ctScore: $('ct-score'), ctLogo: $('ct-logo'),
    tName: $('t-name'),   tScore: $('t-score'),   tLogo: $('t-logo'),
    mapName: $('map-name'), roundNum: $('round-num'),
    timer: $('timer'),
    bombIndicator: $('bomb-indicator'), bombState: $('bomb-state'),
    players: $('players'),
    ctPlayers: $('ct-players'), tPlayers: $('t-players'),
    bottomInfo: $('bottom-info'),
    obsName: $('obs-name'), obsStats: $('obs-stats'),
    seriesScore: $('series-score'), seriesText: $('series-text'),
  };

  // ─── WebSocket connection ───
  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[OPENHUD] WebSocket connected');
      reconnectDelay = 1000;
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      lastData = msg;
      if (window.OpenHUD_EVENTS && window.OpenHUD_EVENTS.handle(msg)) return;
      render(window.OpenHUD_EVENTS ? window.OpenHUD_EVENTS.orientSnapshot(msg) : msg);
    };

    ws.onclose = () => {
      console.log('[OPENHUD] WebSocket closed, reconnecting in', reconnectDelay);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 5000);
    };

    ws.onerror = () => { ws.close(); };
  }

  // ─── Render ───
  function render(data) {
    // Top bar visibility
    if (data.map) {
      els.topbar.classList.remove('hidden');
      els.topbar.classList.add('visible');
      els.mapName.textContent = data.map || '';
      els.roundNum.textContent = data.round ? 'R' + data.round : '';

      // Scores
      if (data.ct_score !== undefined) els.ctScore.textContent = data.ct_score || 0;
      if (data.t_score !== undefined) els.tScore.textContent = data.t_score || 0;
      if (data.ct_name) els.ctName.textContent = data.ct_name || 'Counter-Terrorists';
      if (data.t_name) els.tName.textContent = data.t_name || 'Terrorists';

      // Team initials for logo
      els.ctLogo.textContent = (data.ct_name || 'CT').charAt(0).toUpperCase();
      els.tLogo.textContent  = (data.t_name  || 'T').charAt(0).toUpperCase();
    }

    // Timer
    if (data.round_time !== undefined && data.round_time !== '') {
      const seconds = parseFloat(data.round_time);
      if (!isNaN(seconds)) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        els.timer.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
        els.timer.classList.toggle('low', seconds < 10 && seconds > 0);
        els.timer.classList.toggle('frozen', seconds <= 0);
      }
    }

    // Bomb
    const bomb = data.bomb || '';
    if (bomb === 'planted') {
      els.bombIndicator.classList.remove('hidden');
      els.bombIndicator.classList.add('show', 'planted');
      els.bombState.textContent = 'BOMB PLANTED';
      els.timer.classList.add('low');
    } else if (bomb === 'defused') {
      els.bombIndicator.classList.remove('planted');
      els.bombState.textContent = 'DEFUSED';
      els.bombIndicator.classList.add('show');
      setTimeout(() => els.bombIndicator.classList.remove('show'), 3000);
    } else if (bomb === 'exploded') {
      els.bombState.textContent = 'EXPLODED';
      els.bombIndicator.classList.remove('planted');
      els.bombIndicator.classList.add('show');
      setTimeout(() => els.bombIndicator.classList.remove('show'), 3000);
    } else {
      els.bombIndicator.classList.remove('show', 'planted');
    }

    // Phase
    const phase = data.phase || '';
    if (phase === 'warmup') {
      els.timer.textContent = 'WARMUP';
      els.timer.classList.add('frozen');
    } else if (phase === 'freezetime' || phase === 'timeout') {
      els.timer.textContent = phase === 'timeout' ? 'TIMEOUT' : 'FREEZE';
      els.timer.classList.add('frozen');
    }

    // Players
    if (data.players && data.players.length > 0) {
      els.players.classList.remove('hidden');
      renderPlayers(data.players);
    } else {
      els.players.classList.add('hidden');
    }

    // Series score (custom event)
    if (data.type === 'series') {
      els.seriesScore.classList.remove('hidden');
      els.seriesText.textContent = data.data || '';
    }
  }

  // ─── Player table render ───
  function renderPlayers(players) {
    const ct = players.filter(p => p.team === 'CT');
    const t  = players.filter(p => p.team === 'T');

    els.ctPlayers.innerHTML = ct.map(p => playerRow(p)).join('');
    els.tPlayers.innerHTML  = t.map(p => playerRow(p)).join('');
  }

  function playerRow(p) {
    const dead = p.health <= 0;
    const hpClass = p.health > 66 ? 'high' : p.health > 33 ? 'mid' : 'low';
    const hpPct = Math.max(0, Math.min(100, p.health));

    let equipment = '';
    if (p.armor > 0) {
      equipment += `<span class="eq-icon eq-armor" title="Armor">${p.armor}</span>`;
    }
    // We don't have helmet/defuse/bomb in snapshot, but structure supports it
    if (p.money !== undefined) {
      equipment += `<span class="p-money">$${p.money}</span>`;
    }

    const kd = `${p.kills || 0}/${p.deaths || 0}`;

    return `
      <div class="player-row ${dead ? 'dead' : ''}">
        <span class="p-slot">${p.observer_slot || ''}</span>
        <span class="p-name">${escapeHtml(p.name)}</span>
        <span class="p-kd">${kd}</span>
        <span class="p-equipment">${equipment}</span>
        <span class="p-hp">
          <span>${dead ? '✕' : p.health}</span>
          <span class="hp-bar"><span class="hp-fill ${hpClass}" style="width:${hpPct}%"></span></span>
        </span>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Start ───
  connect();
  console.log('[OPENHUD] Compact HUD overlay initialised');
})();
