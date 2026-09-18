"""End-to-end verification of tournament Major standards across ALL 3 HUD styles:
1. fennec-broadcast
2. fennec-cyber
3. fennec-championship

Checks for each:
- Clock formatting without raw floats
- C4 Bomb timer 40s (safe/warn/crit/fallback '--')
- Tactical timeouts (CT / T with remaining counts) and Technical pauses
- Series Bo3 context and map pips
- Zero JavaScript errors in browser console
"""
import json, os, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.getenv('HUD_TEST_URL', 'http://127.0.0.1:1349')
OUT = Path(os.getenv('HUD_TEST_OUTPUT', 'F:/anen/desktop/hud-evidence'))
OUT.mkdir(parents=True, exist_ok=True)

SID1 = '76561198000000001'

def packet(phase='live', countdown='75.0', bomb_state='carried', bomb_cd='', ct_rem=3, t_rem=2, ct_score=8, t_score=5):
    people = {}
    for i in range(10):
        sid = str(int(SID1) + i)
        people[sid] = {
            'name': f'Player_{i+1}',
            'team': 'CT' if i < 5 else 'T',
            'observer_slot': i + 1,
            'position': f'{-1000+i*150}, {-400+i*80}, 0',
            'state': {'health': 100 if i not in (3, 8) else 0, 'armor': 100, 'money': 4000, 'helmet': True, 'defusekit': i < 5},
            'match_stats': {'kills': 10, 'deaths': 5, 'assists': 2},
            'weapons': {'weapon_0': {'name': 'weapon_ak47', 'type': 'Rifle', 'state': 'active', 'ammo_clip': 30, 'ammo_reserve': 90}}
        }
    try:
        import sqlite3
        con = sqlite3.connect(r'C:\Users\ANEN\AppData\Roaming\PROTOKOL HUD\protokol.db')
        cur = con.cursor()
        cur.execute("SELECT value FROM settings WHERE key='gsi_token'")
        row = cur.fetchone()
        token = row[0] if row else '439c7fe2-5452-4ee4-94d0-77ff84ffecf9'
    except Exception:
        token = '439c7fe2-5452-4ee4-94d0-77ff84ffecf9'
    return {
        'auth': {'token': token},
        'provider': {'name': 'tournament-e2e'},
        'map': {
            'name': 'de_mirage',
            'phase': phase,
            'round': 14,
            'team_ct': {'score': ct_score, 'name': 'NAVI', 'timeouts_remaining': ct_rem},
            'team_t': {'score': t_score, 'name': 'FAZE', 'timeouts_remaining': t_rem}
        },
        'round': {'phase': phase, 'bomb': bomb_state},
        'bomb': {'state': bomb_state, 'countdown': bomb_cd},
        'phase_countdowns': {'phase': phase, 'phase_ends_in': countdown},
        'player': {'steamid': SID1},
        'allplayers': people,
        'grenades': {}
    }

def push(**kwargs):
    body = packet(**kwargs)
    req = urllib.request.Request(BASE + '/api/gsi',
                                 data=json.dumps(body).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r:
        assert r.status == 200

packs = ['fennec-broadcast', 'fennec-cyber', 'fennec-championship']
summary = {}

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
    
    for pack in packs:
        pack_results = []
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        
        # Initial live load
        push(phase='live', countdown='65.4')
        url = f'{BASE}/overlay/{pack}/index.html'
        page.goto(url, wait_until='networkidle')
        page.wait_for_timeout(400)
        
        # 1. Clock format check
        clock_text = page.locator('#clock').inner_text()
        assert clock_text == '1:05', f'Expected 1:05, got {clock_text} in {pack}'
        pack_results.append({'test': 'clock_format', 'status': 'passed', 'val': clock_text})
        
        # 2. Series state check
        series_text = page.locator('#series-state').inner_text()
        assert 'BO3' in series_text or 'MAP' in series_text, f'Expected BO3/MAP, got {series_text} in {pack}'
        assert page.locator('#ct-series').count() == 1
        assert page.locator('#t-series').count() == 1
        pack_results.append({'test': 'series_context', 'status': 'passed', 'val': series_text})
        
        # 3. C4 Safe (35s)
        push(phase='bomb', countdown='35.2', bomb_state='planted', bomb_cd='35.2')
        page.wait_for_timeout(350)
        b_el = page.locator('#bomb-timer')
        assert b_el.is_visible(), f'bomb-timer should be visible in {pack}'
        assert 'c4-safe' in (b_el.get_attribute('class') or '')
        assert '35' in b_el.inner_text()
        pack_results.append({'test': 'c4_safe', 'status': 'passed'})
        
        # 4. C4 Warn (16s)
        push(phase='bomb', countdown='16.0', bomb_state='planted', bomb_cd='16.0')
        page.wait_for_timeout(350)
        assert 'c4-warn' in (b_el.get_attribute('class') or '')
        assert '16' in b_el.inner_text()
        pack_results.append({'test': 'c4_warn', 'status': 'passed'})
        
        # 5. C4 Crit (7s)
        push(phase='bomb', countdown='7.1', bomb_state='planted', bomb_cd='7.1')
        page.wait_for_timeout(350)
        assert 'c4-crit' in (b_el.get_attribute('class') or '')
        assert '7' in b_el.inner_text()
        pack_results.append({'test': 'c4_crit', 'status': 'passed'})
        
        # 6. C4 honest fallback '--' when countdown missing
        push(phase='bomb', countdown='', bomb_state='planted', bomb_cd='')
        page.wait_for_timeout(350)
        assert '--' in b_el.inner_text(), f'Expected -- in {pack}, got {b_el.inner_text()}'
        pack_results.append({'test': 'c4_fallback_dashes', 'status': 'passed'})
        
        # 7. Tactical Timeout CT
        push(phase='timeout_ct', countdown='29.5', ct_rem=3, t_rem=2)
        page.wait_for_timeout(350)
        t_bar = page.locator('#timeout-bar')
        assert t_bar.is_visible(), f'timeout-bar should be visible during timeout_ct in {pack}'
        t_title = page.locator('#timeout-title').inner_text()
        assert 'TIMEOUT' in t_title or 'PAUSE' in t_title
        pack_results.append({'test': 'timeout_ct', 'status': 'passed'})
        
        # 8. Tactical Timeout T
        push(phase='timeout_t', countdown='25.0', ct_rem=3, t_rem=1)
        page.wait_for_timeout(350)
        assert t_bar.is_visible()
        pack_results.append({'test': 'timeout_t', 'status': 'passed'})
        
        # 9. Technical pause
        push(phase='paused', countdown='0', ct_rem=3, t_rem=1)
        page.wait_for_timeout(350)
        assert t_bar.is_visible()
        pack_results.append({'test': 'tech_pause', 'status': 'passed'})
        
        # 10. Live return -> bar hidden, bomb hidden
        push(phase='live', countdown='110.0', bomb_state='carried', bomb_cd='')
        page.wait_for_timeout(350)
        assert not t_bar.is_visible(), f'timeout-bar should be hidden during live in {pack}'
        assert not b_el.is_visible(), f'bomb-timer should be hidden during live in {pack}'
        pack_results.append({'test': 'live_normal', 'status': 'passed'})
        
        # Check console errors
        assert len(errors) == 0, f'Console errors in {pack}: {errors}'
        
        # Take screenshot of final live state for evidence
        page.screenshot(path=str(OUT / f'{pack}-tournament-verified.png'), omit_background=True)
        summary[pack] = {'results': pack_results, 'errors': errors}
        page.close()
        
    browser.close()

print(json.dumps(summary, indent=2))
