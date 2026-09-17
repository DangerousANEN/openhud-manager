"""Sandbox E2E: SIGNAL LOST watchdog in the real Broadcast HUD.

Scenario (real GSI -> server -> WS -> HUD):
1. fresh GSI frame -> badge hidden;
2. server goes silent for 14s while loadConfig ticks every 5s (a redraw of the
   LAST snapshot must NOT refresh the watchdog);
3. badge becomes visible; a new GSI frame hides it again.
"""
import json, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ns = {}
exec(Path(__file__).with_name('camera_e2e.py').read_text().split('packs=[')[0], ns)
BASE = ns['BASE']; OUT = ns['OUT']

def push():
    body = ns['packet']()
    req = urllib.request.Request(BASE + '/api/gsi', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        assert r.status == 200

badge_hidden = "document.querySelector('#signal-lost').classList.contains('hidden')"
with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=['--no-sandbox'])
    page = b.new_page(viewport={'width': 1920, 'height': 1080})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    push()
    page.goto(BASE + '/overlay/fennec-broadcast/index.html', wait_until='networkidle')
    page.wait_for_function(badge_hidden)
    # 14s of silence > 12s threshold; loadConfig keeps redrawing the LAST snapshot.
    time.sleep(14)
    assert not page.evaluate(badge_hidden), 'badge did not appear during silence'
    assert page.locator('#signal-lost').is_visible()
    assert page.locator('#signal-lost').inner_text() == 'SIGNAL LOST'
    page.screenshot(path=str(OUT / 'broadcast-signal-lost.png'), omit_background=True)
    push()
    page.wait_for_function(badge_hidden, timeout=5000)
    assert not errors, errors
    b.close()
print('SIGNAL-LOST E2E PASS: silent 14s -> badge on; fresh GSI -> badge off; no page errors')
