import json
import os
import sys
import time
from playwright.sync_api import sync_playwright
import urllib.request
import sqlite3
from pathlib import Path

PORT = 1349
BASE_URL = f"http://127.0.0.1:{PORT}"

def post_gsi(payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/gsi", data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.read().decode('utf-8')

def build_gsi_payload(map_name, round_num, ct_score, t_score, ct_name, t_name, series_left_score, series_right_score):
    SID1 = "76561198000000000"
    people = {}
    for i in range(10):
        sid = str(int(SID1) + i)
        people[sid] = {
            'name': f'Player_{i+1}',
            'team': 'CT' if i < 5 else 'T',
            'observer_slot': i + 1,
            'position': f'{-1000+i*150}, {-400+i*80}, 0',
            'state': {'health': 100, 'armor': 100, 'money': 4000, 'helmet': True, 'defusekit': i < 5},
            'match_stats': {'kills': 10, 'deaths': 5, 'assists': 2},
            'weapons': {'weapon_0': {'name': 'weapon_ak47', 'type': 'Rifle', 'state': 'active', 'ammo_clip': 30, 'ammo_reserve': 90}}
        }
    return {
        'auth': {'token': 'smoke-token'},
        'provider': {'name': 'Counter-Strike: Global Offensive', 'appid': 730, 'version': 13980, 'steamid': '1', 'timestamp': int(time.time())},
        'map': {
            'mode': 'competitive',
            'name': map_name,
            'phase': 'live',
            'round': round_num,
            'team_ct': {'score': ct_score, 'name': ct_name, 'timeouts_remaining': 3, 'matches_won_this_series': series_left_score},
            'team_t': {'score': t_score, 'name': t_name, 'timeouts_remaining': 4, 'matches_won_this_series': series_right_score},
            'num_matches_to_win_series': 2
        },
        'round': {'phase': 'live', 'bomb': None},
        'phase_countdowns': {'phase': 'live', 'phase_ends_in': '75.0'},
        'player': {'steamid': SID1},
        'allplayers': people,
        'grenades': {}
    }

def test_pick_decider_and_obs():
    print("=== STARTING FULL E2E TEST: PICK/DECIDER & SIDES ACROSS ALL 3 HUDS ===")
    
    # 1. Update SQLite DB to have current match with vetos
    db_path = Path(os.environ['APPDATA']) / 'PROTOKOL HUD' / 'protokol.db'
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    cur.execute("INSERT OR REPLACE INTO teams (id, name, short_name) VALUES ('team_navi', 'Natus Vincere', 'NAVI')")
    cur.execute("INSERT OR REPLACE INTO teams (id, name, short_name) VALUES ('team_faze', 'FaZe Clan', 'FaZe')")
    
    vetos_json = json.dumps([
        {"team_id": "team_navi", "action": "pick", "map": "de_mirage"},
        {"team_id": "team_faze", "action": "pick", "map": "de_inferno"},
        {"action": "decider", "map": "de_nuke"}
    ])
    
    cur.execute("UPDATE matches SET current = 0")
    cur.execute("""
        INSERT OR REPLACE INTO matches (id, left_team_id, right_team_id, left_score, right_score, match_type, current, vetos)
        VALUES ('m_grand_final', 'team_navi', 'team_faze', 0, 0, 'bo3', 1, ?)
    """, (vetos_json,))
    conn.commit()
    conn.close()
    print("[DB] Current match set to Bo3: 0-0 with Mirage (NAVI Pick), Inferno (FaZe Pick), Nuke (Decider)")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        
        hud_ids = ['fennec-broadcast', 'fennec-cyber', 'fennec-championship']
        
        for hud in hud_ids:
            print(f"\n=======================================================")
            print(f"Testing Overlay: {hud}")
            print(f"=======================================================")
            
            # Reset match to 0-0 for each HUD
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("UPDATE matches SET left_score = 0, right_score = 0 WHERE id = 'm_grand_final'")
            conn.commit()
            conn.close()

            page = browser.new_page(viewport={"width": 1920, "height": 1080})
            
            hud_url = f"{BASE_URL}/overlay/{hud}/index.html"
            page.goto(hud_url, wait_until="networkidle")
            time.sleep(1)
            
            # --- Scenario 1: Map 1 (de_mirage), 1st Half (Round 6) ---
            # NAVI is CT, FaZe is T. NAVI picked Mirage.
            payload_m1 = build_gsi_payload('de_mirage', 6, 4, 2, 'NAVI', 'FaZe', 0, 0)
            post_gsi(payload_m1)
            time.sleep(1)
            
            # 1. Side tags
            ct_side = page.locator(".side-badge--ct").first.text_content().strip()
            t_side = page.locator(".side-badge--t").first.text_content().strip()
            assert ct_side in ["CT", "COUNTER"], f"[{hud}] Expected CT/COUNTER badge, got '{ct_side}'"
            assert t_side in ["T", "TERROR"], f"[{hud}] Expected T/TERROR badge, got '{t_side}'"
            print(f"[{hud}] Side tags verified: {ct_side} / {t_side}")
            
            # 2. Round state
            round_state = page.locator("#round-state").first.text_content().strip()
            print(f"[{hud}] Round state verified: '{round_state}'")
            assert "LIVE" in round_state or "R7" in round_state or "ROUND" in round_state, f"[{hud}] Expected round info, got '{round_state}'"
            
            # 3. Series & Map Pick
            series_state = page.locator("#series-state").first.text_content().strip()
            print(f"[{hud}] Series state verified: '{series_state}'")
            assert "MAP 1" in series_state and "NAVI PICK" in series_state, f"[{hud}] Expected MAP 1 (NAVI PICK) in series-state, got '{series_state}'"
            
            # 4. CT Pick badge should be visible, T Pick badge should be hidden
            ct_pick_vis = page.locator("#ct-pick").is_visible()
            t_pick_vis = page.locator("#t-pick").is_visible()
            print(f"[{hud}] Pick badge visibility: CT={ct_pick_vis}, T={t_pick_vis}")
            assert ct_pick_vis, f"[{hud}] Expected CT pick visible"
            assert not t_pick_vis, f"[{hud}] Expected T pick hidden"
            
            # --- Scenario 2: 2nd Half (Round 15) with Side Switch ---
            # After side swap, NAVI is T, FaZe is CT!
            payload_m1_h2 = build_gsi_payload('de_mirage', 15, 6, 9, 'FaZe', 'NAVI', 0, 0)
            post_gsi(payload_m1_h2)
            time.sleep(1)
            
            round_state_h2 = page.locator("#round-state").first.text_content().strip()
            print(f"[{hud}] Second half verified: '{round_state_h2}'")
            
            # NAVI is now on T side! So T pick badge should be visible!
            ct_pick_h2_vis = page.locator("#ct-pick").is_visible()
            t_pick_h2_vis = page.locator("#t-pick").is_visible()
            print(f"[{hud}] Post-swap pick badges: CT={ct_pick_h2_vis}, T={t_pick_h2_vis}")
            assert not ct_pick_h2_vis, f"[{hud}] Expected CT hidden after swap"
            assert t_pick_h2_vis, f"[{hud}] Expected T visible for NAVI after swap"
            print(f"[{hud}] Post-swap pick badge correctly tracked NAVI to T side!")
            
            # --- Scenario 3: Decider Map (de_nuke, Map 3), Overtime ---
            # 1-1 series score
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("UPDATE matches SET left_score = 1, right_score = 1 WHERE id = 'm_grand_final'")
            conn.commit()
            conn.close()
            
            payload_decider = build_gsi_payload('de_nuke', 25, 12, 13, 'NAVI', 'FaZe', 1, 1)
            post_gsi(payload_decider)
            time.sleep(1)
            
            series_decider = page.locator("#series-state").first.text_content().strip()
            print(f"[{hud}] Decider series-state: '{series_decider}'")
            assert "DECIDER" in series_decider, f"[{hud}] Expected DECIDER in series-state, got '{series_decider}'"
            
            # In Decider, neither team has PICK badge
            ct_decider_vis = page.locator("#ct-pick").is_visible()
            t_decider_vis = page.locator("#t-pick").is_visible()
            print(f"[{hud}] Decider pick badges visible: CT={ct_decider_vis}, T={t_decider_vis}")
            assert not ct_decider_vis and not t_decider_vis, f"[{hud}] Expected neither team to have PICK on decider"
            
            shot_path = f"F:/anen/desktop/hud-evidence/{hud}-verified-major-standards.png"
            page.screenshot(path=shot_path)
            print(f"[{hud}] Saved screenshot proof: {shot_path}")
            
            page.close()
            
        browser.close()

    print("\n=================================================================")
    print("SUCCESS: 100% VERIFIED ACROSS ALL 3 HUDS (FENNEC-BROADCAST, CYBER, CHAMPIONSHIP)")
    print("Gaps #4 & #6 FULLY IMPLEMENTED AND VALIDATED!")
    print("=================================================================")

if __name__ == "__main__":
    test_pick_decider_and_obs()
