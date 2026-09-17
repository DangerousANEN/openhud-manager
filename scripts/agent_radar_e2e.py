"""Sandbox regression: real GSI, transparent radar, visible CT/T agent fallback."""
import os, json, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = os.environ.get('HUD_TEST_URL', 'http://127.0.0.1:1349')
OUT = Path(os.environ.get('HUD_TEST_OUTPUT', '/home/kasm-user/projects/protokol-evidence'))
OUT.mkdir(parents=True, exist_ok=True)
# Reuse fixture helpers without executing the other suite.
ns = {}
exec(Path(__file__).with_name('camera_e2e.py').read_text().split("packs=[")[0], ns)
ns['db']('DELETE FROM cameras')
ns['push']()
report = []
packs = os.environ.get('HUD_TEST_PACKS', 'fennec-cyber,fennec-broadcast,fennec-championship').split(',')
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
    for pack in packs:
        page = browser.new_page(viewport={'width':1920, 'height':1080})
        page.goto(BASE+'/overlay/'+pack+'/index.html', wait_until='networkidle')
        page.wait_for_function("document.querySelector('#cam-inner')?.dataset.cameraState==='unconfigured'")
        cam = page.locator('#cam-inner')
        assert cam.is_visible(), pack
        assert cam.locator('video,iframe').count()==0
        assert 'agents-ct.png' in cam.evaluate('(e)=>getComputedStyle(e).backgroundImage')
        assert cam.evaluate('(e)=>getComputedStyle(e,"::before").content')=='"AGENT"'
        assert page.evaluate("async()=>{let i=new Image();i.src='assets/agents-ct.png';await i.decode();return i.naturalWidth>0}")
        selector = {'fennec-cyber':'.scope-frame','fennec-broadcast':'.inset','fennec-championship':'.plate-frame'}[pack]
        assert page.locator(selector).evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
        assert page.locator(selector).evaluate('(e)=>getComputedStyle(e).boxShadow')=='none'
        page.wait_for_function("document.querySelector('#radar-img').naturalWidth>0")
        alpha = page.locator('#radar-img').evaluate('''i=>{let c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;let x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,1,1).data[3]}''')
        assert alpha == 0, (pack, alpha)
        screenshot = OUT/(pack+'-agent-transparent.png')
        page.screenshot(path=str(screenshot),omit_background=True)
        # Real rendered pixels, not just computed CSS. Sample empty radar corners
        # away from labels, map art, borders and player markers.
        from PIL import Image
        image = Image.open(screenshot).convert('RGBA')
        bounds = page.locator(selector).bounding_box()
        samples = []
        for fx, fy in [(0.06,0.06),(0.94,0.06),(0.06,0.94),(0.94,0.94)]:
            x = int(bounds['x'] + bounds['width']*fx)
            y = int(bounds['y'] + bounds['height']*fy)
            pixel = image.getpixel((x,y))
            samples.append({'x':x,'y':y,'rgba':pixel})
            if pixel[3] != 0:
                stack = page.evaluate('''([x,y])=>document.elementsFromPoint(x,y).map(e=>({tag:e.tagName,id:e.id,classes:e.className,background:getComputedStyle(e).background,shadow:getComputedStyle(e).boxShadow,filter:getComputedStyle(e).filter}))''',[x,y])
                raise AssertionError({'pack':pack,'selector':selector,'pixel':samples[-1],'stack':stack})
        ns['push'](str(int(ns['SID1'])+5))
        page.wait_for_function("getComputedStyle(document.querySelector('#cam-inner')).backgroundImage.includes('agents-t.png')")
        assert cam.is_visible()
        report.append({'pack':pack,'ct_agent':True,'t_agent':True,'transparent_radar':True,'fake_live_label':False})
        ns['push']()
        page.close()
    browser.close()
assert len(report)==len(packs)
(OUT/'agent-radar-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
