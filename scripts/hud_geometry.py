"""Geometry, visibility and distinct DOM checks for the three actual HUD structures."""
import json,itertools,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv('HUD_TEST_URL','http://127.0.0.1:1349')
OUT=Path(os.getenv('HUD_TEST_OUTPUT','/home/kasm-user/projects/protokol-evidence'));OUT.mkdir(parents=True,exist_ok=True)
SELECTORS={
'fennec-cyber':{'radar':'#scope','score':'#pods','left':'#ct-cols','right':'#t-cols','focus':'#dossier','camera':'#cam-inner'},
'fennec-broadcast':{'radar':'#inset','score':'#bug','left':'#ct-sheet','right':'#t-sheet','focus':'#strap','camera':'#cam-inner'},
'fennec-championship':{'radar':'#plate','score':'#crest','left':'#ct-podium','right':'#t-podium','focus':'#spotlight','camera':'#cam-inner'},
}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox']);sets={};report=[]
 for pack,sels in SELECTORS.items():
  p=b.new_page(viewport={'width':1920,'height':1080});p.goto(BASE+'/overlay/'+pack+'/index.html');p.wait_for_timeout(1200)
  sets[pack]=set(p.evaluate("[...document.querySelectorAll('*')].flatMap(e=>[...e.classList])"))
  for width,height in [(1920,1080),(1280,720),(2560,1440)]:
   p.set_viewport_size({'width':width,'height':height});p.wait_for_timeout(150); rects={}
   for role,sel in sels.items():
    loc=p.locator(sel);assert loc.count()==1,(pack,'missing',role,sel)
    assert loc.is_visible(),(pack,'hidden',role)
    r=loc.bounding_box();rects[role]=r
    assert r['x']>=-1 and r['y']>=-1 and r['x']+r['width']<=width+1 and r['y']+r['height']<=height+1,(pack,role,r,width)
   assert rects['radar']['x']<width*.1 and rects['radar']['y']<height*.1
   assert rects['score']['y']<height*.1 and width*.2<rects['score']['x']<width*.4
   assert rects['left']['x']<width*.1 and rects['left']['y']>height*.6
   assert rects['right']['x']>width*.7 and rects['right']['y']>height*.6
   assert rects['focus']['y']>height*.85 and width*.2<rects['focus']['x']<width*.4
   for a,c in itertools.combinations(rects,2):
    if set((a,c))=={'focus','camera'}:continue
    r,s=rects[a],rects[c];inter=max(0,min(r['x']+r['width'],s['x']+s['width'])-max(r['x'],s['x']))*max(0,min(r['y']+r['height'],s['y']+s['height'])-max(r['y'],s['y']))
    assert inter<2,(pack,a,c,inter)
   report.append({'pack':pack,'resolution':[width,height],'anchors':True,'overlap':0,'bounds':True})
  p.close()
 for a,c in itertools.combinations(sets,2):
  overlap=len(sets[a]&sets[c])/len(sets[a]|sets[c]);assert overlap<.6,(a,c,overlap)
  report.append({'pair':[a,c],'class_jaccard':round(overlap,4)})
 b.close()
(OUT/'geometry.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
