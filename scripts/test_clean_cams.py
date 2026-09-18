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
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.read()

def main():
    print("=== Testing Clean Player Cam & Agent Fallback across HUDs ===")
    
    # 1. Start smoke server if not running
    # Payload with focused player spectated (player_0 on CT, s1mple)
    payload = {
        "auth": {"token": "smoke-token"},
        "provider": {"name": "Counter-Strike: Global Offensive", "appid": 730, "version": 13980, "steamid": "111", "timestamp": int(time.time())},
        "map": {
            "mode": "competitive", "name": "de_mirage", "phase": "live", "round": 5,
            "team_ct": {"score": 3, "name": "NAVI", "timeouts_remaining": 3},
            "team_t": {"score": 2, "name": "FaZe", "timeouts_remaining": 4},
            "num_matches_to_win_series": 2
        },
        "round": {"phase": "live", "bomb": None},
        "player": {
            "steamid": "76561198034202275",
            "name": "s1mple",
            "team": "CT",
            "activity": "playing",
            "state": {"health": 100, "armor": 100, "helmet": True, "defusekit": True, "money": 3400, "round_kills": 2},
            "weapons": {
                "weapon_0": {"name": "weapon_knife", "type": "Knife", "state": "holstered"},
                "weapon_1": {"name": "weapon_ak47", "type": "Rifle", "state": "active", "ammo_clip": 30, "ammo_reserve": 90}
            },
            "match_stats": {"kills": 14, "assists": 3, "deaths": 4, "mvps": 2, "score": 32}
        },
        "allplayers": {
            "76561198034202275": {
                "name": "s1mple", "observer_slot": 1, "team": "CT",
                "state": {"health": 100, "armor": 100, "helmet": True, "defusekit": True, "money": 3400, "round_kills": 2},
                "match_stats": {"kills": 14, "assists": 3, "deaths": 4, "mvps": 2, "score": 32},
                "weapons": {"weapon_1": {"name": "weapon_ak47", "type": "Rifle", "state": "active", "ammo_clip": 30, "ammo_reserve": 90}}
            },
            "76561198034202276": {
                "name": "b1t", "observer_slot": 2, "team": "CT",
                "state": {"health": 90, "armor": 100, "helmet": True, "money": 2100, "round_kills": 1},
                "match_stats": {"kills": 9, "assists": 2, "deaths": 4, "mvps": 1, "score": 20},
                "weapons": {"weapon_1": {"name": "weapon_m4a1_silencer", "type": "Rifle", "state": "active", "ammo_clip": 20, "ammo_reserve": 80}}
            },
            "76561198034202280": {
                "name": "broky", "observer_slot": 6, "team": "T",
                "state": {"health": 85, "armor": 100, "helmet": True, "money": 4500, "round_kills": 1},
                "match_stats": {"kills": 11, "assists": 1, "deaths": 5, "mvps": 1, "score": 25},
                "weapons": {"weapon_1": {"name": "weapon_awp", "type": "SniperRifle", "state": "active", "ammo_clip": 5, "ammo_reserve": 30}}
            }
        }
    }

    out_dir = Path("F:/anen/desktop/hud-evidence")
    out_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        hud_ids = ["fennec-broadcast", "fennec-cyber", "fennec-championship"]
        
        for hud in hud_ids:
            page = browser.new_page(viewport={"width": 1920, "height": 1080})
            url = f"{BASE_URL}/overlay/{hud}/index.html"
            page.goto(url)
            page.wait_for_timeout(1000)
            
            # Post GSI
            post_gsi(payload)
            page.wait_for_timeout(1000)
            
            # Verify #cam-inner has no border and no before text
            cam_inner = page.locator("#cam-inner").first
            assert cam_inner.is_visible(), f"[{hud}] cam-inner must be visible"
            
            # Check computed style
            border = page.evaluate("el => window.getComputedStyle(el).borderTopWidth", cam_inner.element_handle())
            print(f"[{hud}] cam-inner borderTopWidth: {border}")
            assert border in ["0px", ""], f"[{hud}] Expected 0px border, got {border}"
            
            # Check pseudo-element content
            before_content = page.evaluate("el => window.getComputedStyle(el, '::before').content", cam_inner.element_handle())
            print(f"[{hud}] cam-inner ::before content: {before_content}")
            assert before_content in ["none", "normal", '""', ""], f"[{hud}] Expected no ::before content, got {before_content}"
            
            # Check background image has agent
            bg_image = page.evaluate("el => window.getComputedStyle(el).backgroundImage", cam_inner.element_handle())
            print(f"[{hud}] cam-inner backgroundImage: {bg_image}")
            assert "agents-ct.png" in bg_image, f"[{hud}] Expected agents-ct.png in background, got {bg_image}"

            # Capture screenshot
            shot_path = out_dir / f"{hud}-clean-agent-major.png"
            page.screenshot(path=str(shot_path))
            print(f"[{hud}] Clean screenshot saved to {shot_path}")
            
            page.close()
            
        browser.close()
    print("=== ALL 3 HUDS VERIFIED CLEAN MAJOR AGENTS & CAM! ===")

if __name__ == "__main__":
    main()
