"""Sandbox: score-change path over real GSI -> server -> WS -> HUD.

One known scenario: CT wins round 12 (8-4 -> 9-4), CS2 bumps map.round and
switches phase to 'over'; next round starts as R13. Asserts server snapshot
(/api/state), the WS-delivered values the HUD consumes, and the rendered DOM.
"""
import json, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ns = {}
exec(Path(__file__).with_name('camera_e2e.py').read_text().split('packs=[')[0], ns)
BASE = ns['BASE']; OUT = ns['OUT']

def push(phase, ct_score, t_score, map_round):
    body = ns['packet']()
    body['round']['phase'] = phase
    body['phase_countdowns'] = {'phase': phase, 'phase_ends_in': '5.0' if phase == 'over' else '65.2'}
    body['map']['round'] = map_round
    body['map']['team_ct']['score'] = ct_score
    body['map']['team_t']['score'] = t_score
    req = urllib.request.Request(BASE + '/api/gsi', data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        assert r.status == 200

def server_state():
    with urllib.request.urlopen(BASE + '/api/state', timeout=5) as r:
        return json.load(r)

report = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})
    errors = []; ws_scores = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('websocket', lambda ws: ws.on('framereceived', lambda f: ws_scores.append(f)))
    push('live', 8, 4, 11)
    page.goto(BASE + '/overlay/fennec-broadcast/index.html', wait_until='networkidle')
    # (phase, ct, t, map_round, expect_ct, expect_t, expect_round_label)
    cases = [
        ('live', 8, 4, 11, '8', '4', 'R12 · LIVE'),
        ('over', 9, 4, 12, '9', '4', 'R12 · ROUND OVER'),
        ('live', 9, 4, 12, '9', '4', 'R13 · LIVE'),
    ]
    for phase, ct, t, mr, ect, et, estate in cases:
        push(phase, ct, t, mr)
        page.wait_for_function('t=>document.querySelector("#round-state").textContent===t', arg=estate)
        got_ct = page.locator('#ct-score').inner_text()
        got_t = page.locator('#t-score').inner_text()
        srv = server_state()
        assert got_ct == ect and got_t == et, (phase, got_ct, got_t)
        assert srv['ct_score'] == ct and srv['t_score'] == t, (phase, srv['ct_score'], srv['t_score'])
        page.screenshot(path=str(OUT / f'broadcast-score-{phase}-{ct}{t}.png'), omit_background=True)
        report.append({'phase': phase, 'server': [srv['ct_score'], srv['t_score']],
                       'dom': [got_ct, got_t], 'round_state': estate, 'ok': True})
    assert ws_scores, 'no websocket frames'
    assert not errors, errors
    browser.close()
(OUT / 'broadcast-score-results.json').write_text(json.dumps({'cases': report, 'ws_frames': len(ws_scores)}, indent=2))
print(json.dumps({'cases': report, 'ws_frames': len(ws_scores), 'browser_errors': errors}, indent=2))
