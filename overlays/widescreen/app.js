/* ════════════════════════════════════════════════════════════════
   OpenHUD WIDESCREEN HUD — WebSocket data consumer
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
  let lastPlayers = null;
  let killFeed = [];
  let prevAliveCt = 5, prevAliveT = 5;

  const $ = (id) => document.getElementById(id);
  const els = {
    topbar: $('topbar'),
    ctName: $('ct-name'), ctScore: $('ct-score'), ctTag: $('ct-tag'),
    tName: $('t-name'), tScore: $('t-score'), tTag: $('t-tag'),
    ctPct: $('ct-pct'), tPct: $('t-pct'),
    roundLabel: $('round-label'),
    timer: $('timer'),
    bombState: $('bomb-state'),
    mapPill: $('map-pill'),
    ctPanel: $('ct-panel'), tPanel: $('t-panel'),
    ctCards: $('ct-cards'), tCards: $('t-cards'),
    killfeed: $('killfeed'),
    feedEntries: $('feed-entries'),
    seriesBanner: $('series-banner'),
    seriesFormat: $('series-format'),
    seriesMaps: $('series-maps'),
  };

  // ─── WebSocket ───
  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { reconnectDelay = 1000; console.log('[OpenHUD WS] connected'); };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (window.OpenHUD_EVENTS && window.OpenHUD_EVENTS.handle(msg)) return;
      handleMessage(window.OpenHUD_EVENTS ? window.OpenHUD_EVENTS.orientSnapshot(msg) : msg);
    };
    ws.onclose = () => {
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 5000);
    };
    ws.onerror = () => ws.close();
  }

  function handleMessage(msg) {
    // GSI snapshot
    if (msg.map !== undefined) {
      renderTopBar(msg);
      renderPlayers(msg.players || []);
      detectKills(msg.players || []);
    }
    // Control events
    if (msg.type === 'series') {
      showSeries(msg.data);
    }
    if (msg.type === 'sponsor') {
      // Legacy single-sponsor event: still supported.
      var parts = document.getElementById('sponsor-slot');
      if (parts && msg.data && msg.data.image) {
        var im = parts.querySelector('img');
        if (im) { parts.style.display = ''; im.style.display = ''; im.src = msg.data.image; }
      }
    }
  }

  // ─── Top Bar ───
  function renderTopBar(data) {
    els.topbar.classList.remove('hidden');

    els.ctName.textContent = data.ct_name || 'Counter-Terrorists';
    els.tName.textContent  = data.t_name  || 'Terrorists';
    els.ctScore.textContent = data.ct_score || 0;
    els.tScore.textContent  = data.t_score  || 0;

    els.ctTag.textContent = (data.ct_name || 'CT').substring(0, 4).toUpperCase();
    els.tTag.textContent  = (data.t_name  || 'T').substring(0, 4).toUpperCase();

    // Win percentage (simple heuristic)
    const totalRounds = (data.ct_score || 0) + (data.t_score || 0);
    if (totalRounds > 0) {
      els.ctPct.textContent = Math.round((data.ct_score / totalRounds) * 100) + '%';
      els.tPct.textContent  = Math.round((data.t_score  / totalRounds) * 100) + '%';
    } else {
      els.ctPct.textContent = els.tPct.textContent = '';
    }

    // Round
    els.roundLabel.textContent = data.round ? 'Round ' + data.round : 'Round 1';

    // Map
    els.mapPill.textContent = data.map || '';

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

    // Phase overrides
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

    // Bomb
    const bomb = data.bomb || '';
    if (bomb === 'planted') {
      els.bombState.textContent = 'BOMB PLANTED';
      els.bombState.classList.add('active');
      els.timer.classList.add('low');
    } else if (bomb === 'defused') {
      els.bombState.textContent = 'DEFUSED';
      els.bombState.classList.remove('active');
      setTimeout(() => { els.bombState.textContent = ''; }, 3000);
    } else if (bomb === 'exploded') {
      els.bombState.textContent = 'EXPLODED';
      els.bombState.classList.remove('active');
      setTimeout(() => { els.bombState.textContent = ''; }, 3000);
    } else {
      els.bombState.textContent = '';
      els.bombState.classList.remove('active');
    }
  }

  // ─── Player Cards ───
  function renderPlayers(players) {
    if (!players || players.length === 0) {
      els.ctPanel.classList.add('hidden');
      els.tPanel.classList.add('hidden');
      return;
    }

    const ct = players.filter(p => p.team === 'CT');
    const t  = players.filter(p => p.team === 'T');

    if (ct.length > 0) {
      els.ctPanel.classList.remove('hidden');
      els.ctCards.innerHTML = ct.map(cardHtml).join('');
    } else {
      els.ctPanel.classList.add('hidden');
    }

    if (t.length > 0) {
      els.tPanel.classList.remove('hidden');
      els.tCards.innerHTML = t.map(cardHtml).join('');
    } else {
      els.tPanel.classList.add('hidden');
    }
  }

  function cardHtml(p) {
    const dead = p.health <= 0;
    const hpClass = p.health > 66 ? 'high' : p.health > 33 ? 'mid' : 'low';
    const hpPct = Math.max(0, Math.min(100, p.health));
    const kd = (p.kills || 0) + '/' + (p.deaths || 0);

    return `<div class="p-card ${p.team === 'CT' ? 'ct-card' : 't-card'} ${dead ? 'dead' : ''}">
      <span class="p-card-slot">${p.observer_slot || ''}</span>
      <span class="p-card-name">${esc(p.name)}</span>
      <span class="p-card-money">$${p.money || 0}</span>
      <span class="p-card-kd">${kd}</span>
      <span class="p-card-hp">
        ${dead ? '<span style="color:var(--red)">✕</span>' : '<span>' + p.health + '</span>'}
        <span class="hp-bar"><span class="hp-fill ${hpClass}" style="width:${hpPct}%"></span></span>
      </span>
    </div>`;
  }

  // ─── Kill Detection (basic: detects death by health drops) ───
  function detectKills(players) {
    const aliveCt = players.filter(p => p.team === 'CT' && p.health > 0).length;
    const aliveT  = players.filter(p => p.team === 'T'  && p.health > 0).length;

    if (aliveCt < prevAliveCt) {
      addKillFeed('T', 'CT', prevAliveCt - aliveCt);
    }
    if (aliveT < prevAliveT) {
      addKillFeed('CT', 'T', prevAliveT - aliveT);
    }

    prevAliveCt = aliveCt;
    prevAliveT = aliveT;
  }

  function addKillFeed(killerTeam, victimTeam, count) {
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerHTML = `<span class="kill-killer ${killerTeam.toLowerCase()}">${killerTeam}</span>` +
      `<span class="kill-arrow">→</span>` +
      `<span class="kill-victim ${victimTeam.toLowerCase()}">${victimTeam}</span>` +
      (count > 1 ? `<span class="kill-weapon">x${count}</span>` : '');
    els.feedEntries.appendChild(entry);
    els.killfeed.classList.remove('hidden');

    setTimeout(() => entry.remove(), 5000);
    // Keep max 5 entries
    while (els.feedEntries.children.length > 5) {
      els.feedEntries.removeChild(els.feedEntries.firstChild);
    }
  }

  // ─── Series ───
  function showSeries(data) {
    if (!data) return;
    els.seriesBanner.classList.remove('hidden');
    if (data.format) els.seriesFormat.textContent = data.format;
    if (data.score) els.seriesMaps.textContent = data.score;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  connect();
  console.log('[OPENHUD] Widescreen HUD initialised');
})();
