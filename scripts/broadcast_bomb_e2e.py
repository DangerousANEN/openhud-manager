"""Sandbox integration: bomb phase over real GSI -> server -> WebSocket -> HUD.

Extends broadcast_alive_e2e.py: pushes a planted-bomb packet, asserts the score
bug swaps the round clock for the C4 countdown (green->yellow->red thresholds).
Run with XDG_DATA_HOME pointed at the isolated data dir, server on :1349.
"""
import json, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ns = {}
exec(Path(__file__).with_name('camera_e2e.py').read_text().split('packs=[')[0], ns)
BASE = ns['BASE']; OUT = ns['OUT']

def push(phase, bomb_state=None, bomb_countdown=None):
    body = ns['packet']()
    body['round']['phase'] = phase
    body['phase_countdowns'] = {'phase': phase, 'phase_ends_in': '65.2'}
    if bomb_countdown is not None:
        body['bomb'] = {'state': bomb_state, 'position': '-1500, 300, 0',
                        'countdown': bomb_countdown}
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
    cases = [
        # (bomb_state, countdown, expect_visible, expect_text, expect_zone)
        ('planted', '40.0', True, '40', 'c4-safe'),
        ('planted', '12.0', True, '12', 'c4-warn'),
        ('planted', '3.5', True, '3', 'c4-crit'),
        ('planted', '', True, '--', ''),   # missing countdown: honest "--", never fake 0
        ('live', None, False, '', ''),
    ]
    for state, countdown, visible, text, cls in cases:
        push('bomb' if state == 'planted' else 'live',
             bomb_state=state, bomb_countdown=countdown)
        page.wait_for_timeout(400)
        bomb = page.locator('#bomb-timer')
        if visible:
            assert bomb.is_visible(), 'bomb timer hidden at ' + countdown
            assert bomb.inner_text() == text, (countdown, bomb.inner_text())
            assert cls in (bomb.get_attribute('class') or ''), (countdown, bomb.get_attribute('class'))
            fill = bomb.locator('i')
            fill_w = fill.bounding_box()['width']; box_w = bomb.bounding_box()['width']
            ratio = fill_w / box_w
            expected_ratio = float(countdown) / 40.0 if countdown else 0.0
            assert abs(ratio - expected_ratio) < 0.02, (countdown, ratio, expected_ratio)
        else:
            assert bomb.count() == 0 or not bomb.is_visible(), 'timer visible without bomb'
        page.screenshot(path=str(OUT / f'broadcast-bomb-{state}-{countdown}.png'), omit_background=True)
        report.append({'state': state, 'countdown': countdown, 'visible': visible,
                       'text': text, 'class': cls, 'ok': True})
    assert frames, 'no websocket frames'
    assert not errors, errors
    browser.close()
(OUT / 'broadcast-bomb-results.json').write_text(json.dumps({'cases': report, 'ws_frames': len(frames)}, indent=2))
print(json.dumps({'cases': report, 'ws_frames': len(frames), 'browser_errors': errors}, indent=2))
