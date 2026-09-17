"""Sandbox integration: tactical timeout and tech pause E2E.

Verifies:
1. CT timeout: #timeout-bar is visible, class has timeout--ct, team name is ALPHA,
   countdown shows on clock, remaining timeouts shown.
2. T timeout: #timeout-bar is visible, class has timeout--t, team name is BRAVO,
   countdown shows on clock, remaining timeouts shown.
3. Tech pause: #timeout-bar is visible, class has timeout--tech, TECHNICAL PAUSE title.
4. Normal live: #timeout-bar is hidden.
5. 0 page errors throughout.
"""
import json, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ns = {}
exec(Path(__file__).with_name('camera_e2e.py').read_text().split('packs=[')[0], ns)
BASE = ns['BASE']; OUT = ns['OUT']

def push(phase, countdown='30.0', ct_rem=3, t_rem=1):
    body = ns['packet']()
    body['round']['phase'] = phase
    body['phase_countdowns'] = {'phase': phase, 'phase_ends_in': countdown}
    body['map']['team_ct']['timeouts_remaining'] = ct_rem
    body['map']['team_t']['timeouts_remaining'] = t_rem
    req = urllib.request.Request(BASE + '/api/gsi',
                                 data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        assert r.status == 200

report = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    errors = []; frames = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('websocket', lambda ws: ws.on('framereceived', lambda f: frames.append(f)))
    
    push('live')
    page.goto(BASE + '/overlay/fennec-broadcast/index.html', wait_until='networkidle')
    
    # Case 1: CT tactical timeout
    push('timeout_ct', countdown='28.4', ct_rem=3, t_rem=2)
    page.wait_for_timeout(400)
    bar = page.locator('#timeout-bar')
    assert bar.is_visible(), 'timeout bar should be visible during timeout_ct'
    assert 'timeout--ct' in (bar.get_attribute('class') or '')
    assert page.locator('#timeout-team').inner_text() == 'TEAM ALPHA'
    assert 'TACTICAL TIMEOUT' in page.locator('#timeout-title').inner_text()
    assert '3 REMAINING' in page.locator('#timeout-remaining').inner_text()
    assert page.locator('#clock').inner_text() == '0:28'
    assert 'CT TIMEOUT' in page.locator('#round-state').inner_text()
    page.screenshot(path=str(OUT / 'broadcast-timeout-ct.png'), omit_background=True)
    report.append({'case': 'timeout_ct', 'visible': True, 'team': 'TEAM ALPHA', 'remaining': '3 REMAINING'})

    # Case 2: T tactical timeout
    push('timeout_t', countdown='15.0', ct_rem=3, t_rem=1)
    page.wait_for_timeout(400)
    assert bar.is_visible(), 'timeout bar should be visible during timeout_t'
    assert 'timeout--t' in (bar.get_attribute('class') or '')
    assert page.locator('#timeout-team').inner_text() == 'TEAM BRAVO'
    assert 'TACTICAL TIMEOUT' in page.locator('#timeout-title').inner_text()
    assert '1 REMAINING' in page.locator('#timeout-remaining').inner_text()
    assert page.locator('#clock').inner_text() == '0:15'
    assert 'T TIMEOUT' in page.locator('#round-state').inner_text()
    page.screenshot(path=str(OUT / 'broadcast-timeout-t.png'), omit_background=True)
    report.append({'case': 'timeout_t', 'visible': True, 'team': 'TEAM BRAVO', 'remaining': '1 REMAINING'})

    # Case 3: Technical pause
    push('paused', countdown='0', ct_rem=3, t_rem=1)
    page.wait_for_timeout(400)
    assert bar.is_visible(), 'timeout bar should be visible during paused'
    assert 'timeout--tech' in (bar.get_attribute('class') or '')
    assert 'TECHNICAL PAUSE' in page.locator('#timeout-title').inner_text()
    assert 'PAUSED' in page.locator('#round-state').inner_text()
    page.screenshot(path=str(OUT / 'broadcast-pause-tech.png'), omit_background=True)
    report.append({'case': 'paused', 'visible': True, 'title': 'TECHNICAL PAUSE'})

    # Case 4: Return to live play -> banner hidden
    push('live', countdown='105.0', ct_rem=3, t_rem=1)
    page.wait_for_timeout(400)
    assert not bar.is_visible(), 'timeout bar should be hidden during live'
    assert page.locator('#clock').inner_text() == '1:45'
    report.append({'case': 'live', 'visible': False})

    assert frames, 'no websocket frames received'
    assert not errors, errors
    browser.close()

(OUT / 'broadcast-timeout-results.json').write_text(json.dumps({'cases': report, 'ws_frames': len(frames)}, indent=2))
print(json.dumps({'cases': report, 'ws_frames': len(frames), 'browser_errors': errors}, indent=2))
