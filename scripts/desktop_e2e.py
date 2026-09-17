"""Desktop UI/IPC integration test via the actual Tauri WebKit window in Linux sandbox."""
import base64, json, os, time, urllib.request, subprocess
from pathlib import Path
HOST='http://127.0.0.1:4444'
OUT=Path('/home/kasm-user/projects/protokol-evidence'); OUT.mkdir(parents=True,exist_ok=True)
def call(method,path,body=None):
    req=urllib.request.Request(HOST+path,data=None if body is None else json.dumps(body).encode(),method=method,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=45) as r: result=json.load(r)
    if isinstance(result.get('value'),dict) and result['value'].get('error') and 'ok' not in result['value']: raise RuntimeError(result)
    return result.get('value')
result=call('POST','/session',{'capabilities':{'alwaysMatch':{'tauri:options':{'application':os.environ['PROTOKOL_BINARY']}}}})
sid=result['sessionId']; root='/session/'+sid

def js(script,*args): return call('POST',root+'/execute/sync',{'script':script,'args':list(args)})
def wait(script,timeout=30):
    end=time.time()+timeout
    while time.time()<end:
        if js('return '+script): return
        time.sleep(.2)
    raise AssertionError('Timed out: '+script+' PAGE: '+str(js('return {url:location.href,text:document.body.innerText,links:[...document.querySelectorAll("a")].map(x=>x.getAttribute("href"))}')))
def click_text(text): js("const e=[...document.querySelectorAll('button,a')].find(x=>x.textContent.trim()===arguments[0]); if(!e)throw Error('Missing '+arguments[0]);e.click();",text)
def fill(selector,value): js("const e=document.querySelector(arguments[0]);if(!e)throw Error('missing '+arguments[0]);e.value=arguments[1];e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));",selector,value)
def screenshot(name):
    for proc in Path('/proc').glob('[0-9]*/cmdline'):
        try:
            if proc.read_bytes().split(b'\0')[0].endswith(b'tauri-driver'):
                env=proc.with_name('environ').read_bytes().split(b'\0')
                display=next(x.split(b'=',1)[1].decode() for x in env if x.startswith(b'DISPLAY='))
                os.environ['XAUTHORITY']=next(x.split(b'=',1)[1].decode() for x in env if x.startswith(b'XAUTHORITY='))
                subprocess.run(['ffmpeg','-v','error','-y','-f','x11grab','-video_size','1600x1000','-i',display,'-frames:v','1',str(OUT/name)],check=True,timeout=20);return
        except (PermissionError,FileNotFoundError,StopIteration): pass
    raise RuntimeError('No isolated display found')
def invoke(command,args={}):
    return call('POST',root+'/execute/async',{'script':"const done=arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke(arguments[0],arguments[1]).then(x=>done({ok:true,value:x})).catch(e=>done({ok:false,error:String(e)}));",'args':[command,args]})
try:
    wait("!!document.querySelector('nav button')")
    click_text("Веб-камеры")
    wait("document.body.textContent.includes('Веб-камеры игроков')")
    click_text('Добавить камеру')
    fill('input[placeholder="76561198000000000"]','76561198000000001')
    fill('input[placeholder^="https://vdo.ninja/"]','http://127.0.0.1:1349/overlay/_test/cam-a.webm')
    click_text('Сохранить')
    wait("!!document.querySelector('tbody tr')")
    cams=invoke('cameras_list'); assert cams['ok'] and cams['value'][0]['steamid']=='76561198000000001',cams
    click_text('Превью')
    wait("!!document.querySelector('video')")
    wait("document.querySelector('video').readyState>=2")
    t=js('return document.querySelector("video").currentTime'); time.sleep(.4)
    assert js('return document.querySelector("video").currentTime')>t
    assert js('return document.querySelector("video").muted')
    screenshot('manager-camera-preview.png')
    click_text('Закрыть')
    js("document.querySelector('tbody button[title=\"Редактировать\"]').click()")
    wait("!!document.querySelector('input[placeholder^=\"https://vdo.ninja/\"]')")
    fill('input[placeholder^="https://vdo.ninja/"]','http://127.0.0.1:1349/overlay/_test/cam-b.webm')
    click_text('Сохранить'); wait("!document.querySelector('input[placeholder^=\"https://vdo.ninja/\"]')")
    assert invoke('cameras_get',{'steamid':'76561198000000001'})['value']['url'].endswith('cam-b.webm')
    js("document.querySelector('tbody button[title^=\"Камера включена\"]').click()")
    wait("document.body.textContent.includes('Отключена')")
    assert invoke('cameras_get',{'steamid':'76561198000000001'})['value']['enabled'] is False
    for url in ['javascript:alert(1)','http:///missing','https://user:pass@example.com/a']:
        r=invoke('cameras_save',{'camera':{'steamid':'76561198000000002','url':url,'kind':'video','enabled':True}}); assert not r['ok'],r
    js('window.confirm=()=>true')
    js("document.querySelector('tbody button[title=\"Удалить\"]').click()")
    wait("document.body.textContent.includes('Веб-камеры игроков пока не настроены')")
    assert invoke('cameras_list')['value']==[]
    routes=js("return [...document.querySelectorAll('aside button.nav-link')].map(e=>e.textContent.trim())")
    for route in dict.fromkeys(routes):
        click_text(route);time.sleep(.25)
        assert js('return document.body.textContent.length')>150,route
    screenshot('manager-desktop.png')
    result={'desktop':True,'camera_ui_create_edit_disable_delete':True,'native_ipc_validation':True,'preview_decoded_video':True,'routes_visited':routes}
    (OUT/'desktop-e2e.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
finally:
    call('DELETE',root)
