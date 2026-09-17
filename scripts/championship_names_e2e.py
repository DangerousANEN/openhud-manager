"""Real HUD name layout regression: full names, single lines, bounded cells."""
import json, os, runpy
from pathlib import Path
from playwright.sync_api import sync_playwright
fixture = {}
source = Path(__file__).with_name('camera_e2e.py').read_text().split("packs=['fennec-cyber'")[0]
exec(compile(source, 'camera_e2e-fixture', 'exec'), fixture)
fixture['push']()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    report = []
    for width,height in [(1280,720),(1920,1080),(2560,1440)]:
        page = browser.new_page(viewport={'width':width,'height':height})
        page.goto('http://127.0.0.1:1349/overlay/fennec-championship/index.html?cam=live')
        page.wait_for_selector('.plinth-name')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(400)
        rows=page.locator('.plinth-name').evaluate_all('''els=>els.map(el=>{
          const r=document.createRange();r.selectNodeContents(el);
          const boxes=[...r.getClientRects()];const b=el.getBoundingClientRect();
          return {name:el.textContent,width:b.width,textWidth:r.getBoundingClientRect().width,
          lines:boxes.length,whiteSpace:getComputedStyle(el).whiteSpace,fontSize:getComputedStyle(el).fontSize};
        })''')
        assert len(rows)==10, rows
        for row in rows:
            assert row['lines']==1 and row['whiteSpace']=='nowrap',row
            assert row['textWidth'] <= row['width']+1,row
        report.append({'viewport':[width,height],'names':rows})
        if width==1920:
            page.screenshot(path='/home/kasm-user/projects/protokol-evidence/championship-names-fixed.png')
        page.close()
    browser.close()
Path('/home/kasm-user/projects/protokol-evidence/championship-names.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
