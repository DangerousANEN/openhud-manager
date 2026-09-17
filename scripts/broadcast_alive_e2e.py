"""Sandbox integration: real GSI -> server -> WebSocket -> unmodified HUD."""
import json, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ns={}
exec(Path(__file__).with_name('camera_e2e.py').read_text().split('packs=[')[0],ns)
BASE=ns['BASE']; OUT=ns['OUT']
def push(phase,dead=0):
    body=ns['packet']()
    body['round']['phase']=phase
    body['phase_countdowns']={'phase':phase,'phase_ends_in':'65.2'}
    for i,p in enumerate(body['allplayers'].values()):
        if i<dead: p['state']['health']=0
    req=urllib.request.Request(BASE+'/api/gsi',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as r: assert r.status==200
report=[]
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1920,'height':1080})
    errors=[]; frames=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('websocket',lambda ws:ws.on('framereceived',lambda frame:frames.append(frame)))
    push('live')
    page.goto(BASE+'/overlay/fennec-broadcast/index.html',wait_until='networkidle')
    for phase,dead,label in [('live',0,'LIVE'),('freezetime',0,'BUY TIME'),('live',2,'LIVE')]:
        push(phase,dead)
        page.wait_for_function('label=>document.querySelector("#round-state").textContent.includes(label)',arg=label)
        expected=f'{5-dead} CT  ·  ALIVE  ·  5 T'
        page.wait_for_function('text=>document.querySelector("#round-flow").textContent===text',arg=expected)
        assert page.locator('#round-flow').is_visible(),'alive hidden in '+phase
        assert page.locator('#clock').inner_text()=='1:05'
        options=ns['request']('/api/hud-options')
        econ=bool(options.get('economy')) and phase=='freezetime'
        assert page.locator('#econ').is_visible()==econ,(phase,options)
        assert page.locator('#ct-rows .row').count()==5
        page.screenshot(path=str(OUT/f'broadcast-real-{phase}-{dead}.png'),omit_background=True)
        report.append({'phase':phase,'dead_ct':dead,'alive':expected,'visible':True,'economy':econ})
    assert frames,'No real WebSocket frames received'
    assert not errors,errors
    b.close()
(OUT/'broadcast-alive-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'cases':report,'websocket_frames':len(frames),'browser_errors':errors},indent=2))
