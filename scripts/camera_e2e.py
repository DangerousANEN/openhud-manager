"""Run inside the isolated Linux sandbox against the real manager server.
Uses deterministic generated video fixtures, not claims of a real player's camera.
"""
import json, os, sqlite3, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = os.getenv('HUD_TEST_URL', 'http://127.0.0.1:1349')
DATA = Path(os.environ.get('XDG_DATA_HOME', str(Path.home()/'.local/share')))/'PROTOKOL HUD'
OUT = Path(os.getenv('HUD_TEST_OUTPUT', '/home/kasm-user/projects/protokol-evidence'))
OUT.mkdir(parents=True, exist_ok=True)
SID1, SID2 = '76561198000000001', '76561198000000002'
def db(sql, args=()):
    with sqlite3.connect(DATA/'protokol.db') as c:
        rows = c.execute(sql,args).fetchall(); c.commit(); return rows

def request(path, body=None):
    req=urllib.request.Request(BASE+path, data=None if body is None else json.dumps(body).encode(), headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=10) as r: return json.load(r)

def packet(focus=SID1):
    people={}
    for i in range(10):
        sid=str(int(SID1)+i)
        people[sid]={'name':['electroNic','Perfecto','PlayerThree','Fourth','Fifth','OppOne','OppTwo','OppThree','OppFour','OppFive'][i], 'team':'CT' if i<5 else 'T', 'observer_slot':i+1,'position':f'{-1500+i*180}, {-600+i*90}, 0','state':{'health':100-i*5,'armor':80,'money':3000,'helmet':True,'defusekit':i<5,'round_kills':1},'match_stats':{'kills':12,'deaths':8,'assists':3},'weapons':{'weapon_0':{'name':'weapon_ak47','type':'Rifle','state':'active','ammo_clip':23,'ammo_reserve':90}}}
    return {'auth':{'token':os.getenv('HUD_TEST_TOKEN') or db("SELECT value FROM settings WHERE key='gsi_token'")[0][0]},'provider':{'name':'camera-e2e-fixture'},'map':{'name':'de_mirage','phase':'live','round':12,'team_ct':{'score':8,'name':'TEAM ALPHA'},'team_t':{'score':4,'name':'TEAM BRAVO'}},'round':{'phase':'live'},'phase_countdowns':{'phase':'live','phase_ends_in':'65'},'player':{'steamid':focus},'allplayers':people,'grenades':{}}

def push(focus=SID1):
    body=packet(focus)
    req=urllib.request.Request(BASE+'/api/gsi',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=10) as r: assert r.status==200

def set_cam(sid,url,kind='video',enabled=1):
    db('INSERT INTO cameras(steamid,url,kind,enabled,muted) VALUES(?,?,?,?,1) ON CONFLICT(steamid) DO UPDATE SET url=excluded.url,kind=excluded.kind,enabled=excluded.enabled',(sid,url,kind,enabled))

packs=['fennec-cyber','fennec-broadcast','fennec-championship']
report=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    for pack in packs:
        set_cam(SID1, BASE+'/overlay/_test/cam-a.webm'); set_cam(SID2, BASE+'/overlay/_test/cam-b.webm')
        push()
        page=browser.new_page(viewport={'width':1920,'height':1080})
        errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/overlay/'+pack+'/index.html',wait_until='networkidle')
        media=page.locator('video[data-protokol-camera]')
        media.wait_for(state='visible')
        page.wait_for_function("document.querySelector('video[data-protokol-camera]')?.readyState>=2")
        a=media.evaluate('(v)=>({time:v.currentTime,muted:v.muted,width:v.videoWidth,height:v.videoHeight})')
        page.wait_for_timeout(450)
        assert media.evaluate('(v)=>v.currentTime')>a['time'],(pack,'video not advancing')
        assert a['muted'] and a['width']>0
        media.evaluate('(v)=>v.dataset.identity="original"')
        push(); page.wait_for_timeout(200)
        assert media.get_attribute('data-identity')=='original','GSI restarted video'
        push(SID2)
        page.wait_for_function("document.querySelector('video[data-protokol-camera]')?.dataset.protokolCamera==='76561198000000002'")
        page.wait_for_function("document.querySelector('video[data-protokol-camera]')?.readyState>=2")
        assert media.get_attribute('data-identity') is None
        page.screenshot(path=str(OUT/(pack+'-video.png')),full_page=True)
        rect=media.bounding_box(); assert rect and rect['width']>100
        assert 1.70<rect['width']/rect['height']<1.84,(pack,rect)
        for width,height in [(1280,720),(2560,1440),(1920,1080)]:
            page.set_viewport_size({'width':width,'height':height}); page.wait_for_timeout(100)
            r=media.bounding_box(); assert r and r['x']>=-1 and r['y']>=-1 and r['x']+r['width']<=width+1 and r['y']+r['height']<=height+1,(pack,width,r)
        set_cam(SID2,BASE+'/overlay/_test/embed.html','iframe')
        page.wait_for_selector('iframe[data-protokol-camera]',timeout=8000)
        iframe=page.frame_locator('iframe[data-protokol-camera]')
        iframe.locator('video').wait_for()
        iframe.locator('video').evaluate('(v)=>v.play()')
        page.wait_for_timeout(300)
        assert iframe.locator('video').evaluate('(v)=>v.currentTime')>0
        set_cam(SID2,BASE+'/overlay/_test/missing.webm')
        page.wait_for_selector('[data-camera-state="error"]',timeout=10000)
        push(''); page.wait_for_timeout(200)
        assert page.locator('[data-protokol-camera]').count()==0,'camera persists after focus removed'
        assert not errors,errors
        report.append({'pack':pack,'video_frames':True,'muted':True,'focus_switch':True,'gsi_keeps_media':True,'iframe_video':True,'error_state':True,'no_focus_cleanup':True,'resolutions':[720,1080,1440]})
        page.close()
    browser.close()
(OUT/'camera-e2e.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
