/* ════════════════════════════════════════════════════════════════
   OpenHUD MINIMAL HUD — WebSocket data consumer
   Connects to the hosting server's /ws endpoint
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

  const $ = id => document.getElementById(id);
  const els = {
    topbar: $('topbar'),
    ctScore: $('ct-score'), tScore: $('t-score'),
    mapName: $('map-name'), roundText: $('round-text'),
    timer: $('timer'),
    obsInfo: $('obs-info'),
    obsSlot: $('obs-slot'), obsName: $('obs-name'),
    obsHp: $('obs-hp'), obsK: $('obs-k'), obsD: $('obs-d'), obsMoney: $('obs-money'),
    bombRail: $('bomb-rail'), bombText: $('bomb-text'),
  };

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { reconnectDelay = 1000; };
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (window.OpenHUD_EVENTS && window.OpenHUD_EVENTS.handle(msg)) return;
      render(window.OpenHUD_EVENTS ? window.OpenHUD_EVENTS.orientSnapshot(msg) : msg);
    };
    ws.onclose = () => {
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 5000);
    };
    ws.onerror = () => ws.close();
  }

  function render(data) {
    // Top bar
    if (data.map !== undefined) {
      els.topbar.classList.remove('hidden');

      els.ctScore.textContent = data.ct_score || 0;
      els.tScore.textContent  = data.t_score  || 0;
      els.mapName.textContent = data.map || '';
      els.roundText.textContent = data.round ? 'Round ' + data.round : '';

      // Timer
      if (data.round_time && data.round_time !== '') {
        const secs = parseFloat(data.round_time);
        if (!isNaN(secs)) {
          const m = Math.floor(secs / 60);
          const s = Math.floor(secs % 60);
          els.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s;
          els.timer.classList.toggle('low', secs < 10 && secs > 0);
          els.timer.classList.toggle('frozen', secs <= 0);
        }
      }

      // Phase
      const phase = data.phase || '';
      if (phase === 'warmup') {
        els.timer.textContent = 'WARMUP';
        els.timer.classList.add('frozen');
      } else if (phase === 'freezetime') {
        els.timer.textContent = 'FREEZE';
        els.timer.classList.add('frozen');
      } else if (phase === 'timeout') {
        els.timer.textContent = 'PAUSE';
        els.timer.classList.add('frozen');
      }
    }

    // Bomb
    const bomb = data.bomb || '';
    if (bomb === 'planted') {
      els.bombRail.classList.remove('hidden', 'defused');
      els.bombRail.classList.add('planted');
      els.bombText.textContent = 'BOMB PLANTED';
    } else if (bomb === 'defused') {
      els.bombRail.classList.remove('planted');
      els.bombRail.classList.add('defused');
      els.bombText.textContent = 'DEFUSED';
      setTimeout(() => els.bombRail.classList.add('hidden'), 3000);
    } else if (bomb === 'exploded') {
      els.bombRail.classList.remove('planted', 'defused');
      els.bombText.textContent = 'EXPLODED';
      setTimeout(() => els.bombRail.classList.add('hidden'), 3000);
    } else {
      els.bombRail.classList.add('hidden');
    }

    // Observer target — find player with observer_slot matching spectated
    // GSI doesn't directly tell us who's spectated, but we can show
    // the player with the highest observer_slot or a custom event
    if (data.players && data.players.length > 0) {
      // Show the player with observer_slot = 1 (likely spectated in GOTV)
      // This is a simplification; real spec mode would need additional GSI data
      const observed = data.players.find(p => p.observer_slot === 1 && p.health > 0)
                   || data.players.find(p => p.health > 0);

      if (observed) {
        els.obsInfo.classList.remove('hidden');
        els.obsSlot.textContent = observed.observer_slot || '';
        els.obsName.textContent = observed.name || '';
        els.obsHp.textContent = observed.health;
        els.obsK.textContent = observed.kills || 0;
        els.obsD.textContent = observed.deaths || 0;
        els.obsMoney.textContent = observed.money || 0;
      } else {
        els.obsInfo.classList.add('hidden');
      }
    } else {
      els.obsInfo.classList.add('hidden');
    }
  }

  connect();
  console.log('[OPENHUD] Minimal HUD initialised');
})();
