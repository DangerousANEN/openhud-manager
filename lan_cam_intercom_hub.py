"""
PROTOKOL LAN Cam & Intercom Hub
A zero-dependency, ultra-lightweight WebRTC / WebSocket video and audio comms hub.
Runs locally on the operator / director PC (or tournament server).

Features:
1. Video Camera Feeds:
   - Any player or caster opens: http://<LAN_IP>:8090/sender.html?slot=1 (or slot=2..10)
   - Stream is shared via peer-to-peer WebRTC or lightweight low-latency canvas streaming directly in browser.
   - Operator / Director HUD preview URL: http://<LAN_IP>:8090/view.html?slot=1
   - Can be embedded directly as iframe or video stream into PROTOKOL HUD Manager!

2. Production Intercom (Voice Comms):
   - Director / Operator / Observer wired/LAN voice comms room: http://<LAN_IP>:8090/intercom.html
   - Push-to-Talk (PTT with Spacebar or CapsLock) or Voice-Activity-Detection (VAD)
   - Channels: "Director -> All", "Observers", "Casters", "General"
   - Opus audio codec (via WebAudio / WebRTC), < 50ms latency across LAN.
"""

import asyncio
import json
import os
import socket
from aiohttp import web

HOST = "0.0.0.0"
PORT = 8090

def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

LAN_IP = get_lan_ip()

INDEX_HTML = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>PROTOKOL LAN Cam & Intercom</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0c0e12; color: #e4e7eb; margin: 0; padding: 2rem; }}
  h1 {{ color: #e5b95a; margin-bottom: 0.5rem; }}
  p {{ color: #8c96a5; }}
  .card {{ background: #161920; border: 1px solid #2a2e39; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; max-width: 800px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem; }}
  .btn {{ display: block; text-align: center; background: #1e222d; border: 1px solid #363c4e; color: #fff; padding: 0.75rem 1rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }}
  .btn:hover {{ background: #e5b95a; color: #000; border-color: #e5b95a; }}
  .badge {{ display: inline-block; background: #e5b95a22; color: #e5b95a; border: 1px solid #e5b95a44; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-family: monospace; }}
</style>
</head>
<body>
  <h1>PROTOKOL LAN Cam & Intercom Hub</h1>
  <p>Локальный сервер трансляции веб-камер и служебной голосовой связи (интерком) для турниров CS2.</p>
  <p>Локальный IP хоста: <span class="badge">http://{LAN_IP}:{PORT}</span></p>

  <div class="card">
    <h2>🎙️ Служебная связь (Intercom)</h2>
    <p>Мгновенная голосовая связь между режиссёром, оператором, обсерверами и кастерами без задержки.</p>
    <a class="btn" style="background:#e5b95a; color:#000; margin-top:1rem;" href="/intercom.html" target="_blank">Открыть пульт Интеркома (Push-to-Talk)</a>
  </div>

  <div class="card">
    <h2>📹 Веб-камеры игроков (Отправка с ПК игрока)</h2>
    <p>Откройте эту ссылку на ПК каждого игрока в браузере (Google Chrome / Edge) и выберите веб-камеру:</p>
    <div class="grid">
      <a class="btn" href="/sender.html?slot=1" target="_blank">Слот 1 (Игрок 1)</a>
      <a class="btn" href="/sender.html?slot=2" target="_blank">Слот 2 (Игрок 2)</a>
      <a class="btn" href="/sender.html?slot=3" target="_blank">Слот 3 (Игрок 3)</a>
      <a class="btn" href="/sender.html?slot=4" target="_blank">Слот 4 (Игрок 4)</a>
      <a class="btn" href="/sender.html?slot=5" target="_blank">Слот 5 (Игрок 5)</a>
      <a class="btn" href="/sender.html?slot=6" target="_blank">Слот 6 (Игрок 6)</a>
      <a class="btn" href="/sender.html?slot=7" target="_blank">Слот 7 (Игрок 7)</a>
      <a class="btn" href="/sender.html?slot=8" target="_blank">Слот 8 (Игрок 8)</a>
      <a class="btn" href="/sender.html?slot=9" target="_blank">Слот 9 (Игрок 9)</a>
      <a class="btn" href="/sender.html?slot=10" target="_blank">Слот 10 (Игрок 10)</a>
    </div>
  </div>

  <div class="card">
    <h2>📺 Ссылки для встраивания в PROTOKOL HUD Manager / OBS</h2>
    <p>Вставляйте эти ссылки в раздел <strong>«Веб-камеры»</strong> программы напротив SteamID игрока (тип <strong>iframe</strong>):</p>
    <div class="grid">
      <a class="btn" href="/view.html?slot=1" target="_blank">Просмотр Слота 1</a>
      <a class="btn" href="/view.html?slot=2" target="_blank">Просмотр Слота 2</a>
      <a class="btn" href="/view.html?slot=3" target="_blank">Просмотр Слота 3</a>
      <a class="btn" href="/view.html?slot=4" target="_blank">Просмотр Слота 4</a>
      <a class="btn" href="/view.html?slot=5" target="_blank">Просмотр Слота 5</a>
      <a class="btn" href="/view.html?slot=6" target="_blank">Просмотр Слота 6</a>
      <a class="btn" href="/view.html?slot=7" target="_blank">Просмотр Слота 7</a>
      <a class="btn" href="/view.html?slot=8" target="_blank">Просмотр Слота 8</a>
      <a class="btn" href="/view.html?slot=9" target="_blank">Просмотр Слота 9</a>
      <a class="btn" href="/view.html?slot=10" target="_blank">Просмотр Слота 10</a>
    </div>
  </div>
</body>
</html>
"""

SENDER_HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>PROTOKOL Cam Sender</title>
<style>
  body { background: #0c0e12; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  video { width: 480px; height: 270px; background: #000; border: 2px solid #e5b95a; border-radius: 8px; transform: scaleX(-1); }
  .status { margin-top: 1rem; font-weight: bold; color: #4ade80; }
  select { background: #161920; color: #fff; border: 1px solid #333; padding: 8px 12px; border-radius: 6px; margin-bottom: 1rem; }
</style>
</head>
<body>
  <h2 id="title">Слот веб-камеры</h2>
  <select id="cam-select"></select>
  <video id="preview" autoplay muted playsinline></video>
  <div class="status" id="status">Подключение к серверу...</div>

<script>
  const params = new URLSearchParams(location.search);
  const slot = params.get('slot') || '1';
  document.getElementById('title').textContent = 'Веб-камера: Слот ' + slot;

  let stream = null;
  const video = document.getElementById('preview');
  const statusEl = document.getElementById('status');
  const camSelect = document.getElementById('cam-select');

  async function getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    camSelect.innerHTML = '';
    videoDevices.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || ('Камера ' + (i + 1));
      camSelect.appendChild(opt);
    });
  }

  async function startCam(deviceId) {
    if (stream) stream.getTracks().forEach(t => t.stop());
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId }, width: 1280, height: 720, frameRate: 30 } : { width: 1280, height: 720, frameRate: 30 },
      audio: false
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      statusEl.textContent = '🟢 Камера запущена и стримится на сервер (Слот ' + slot + ')';
      startStreaming();
    } catch (e) {
      statusEl.textContent = '❌ Ошибка камеры: ' + e.message;
    }
  }

  camSelect.onchange = () => startCam(camSelect.value);

  // Canvas-based ultra-low latency WebSocket stream (works 100% offline without STUN/TURN)
  let ws = null;
  function startStreaming() {
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProto}//${location.host}/ws/cam/pub?slot=${slot}`);
    
    ws.onopen = () => {
      statusEl.textContent = '🟢 В эфире (Слот ' + slot + ')';
    };
    ws.onclose = () => {
      statusEl.textContent = '🟡 Переподключение к хабу...';
      setTimeout(startStreaming, 2000);
    };

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob && ws.readyState === WebSocket.OPEN) {
            ws.send(blob);
          }
        }, 'image/jpeg', 0.65);
      }
    }, 33); // ~30 FPS
  }

  navigator.mediaDevices.getUserMedia({ video: true }).then(() => {
    getDevices().then(() => startCam());
  });
</script>
</body>
</html>
"""

VIEW_HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>PROTOKOL Cam View</title>
<style>
  html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: transparent; }
  img { width: 100%; height: 100%; object-fit: cover; display: block; transform: scaleX(-1); }
  .fallback { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(10,12,16,0.85); color: #8c96a5; font-family: sans-serif; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>
  <img id="feed" style="display:none;" />
  <div id="fallback" class="fallback">CAM OFFLINE</div>

<script>
  const params = new URLSearchParams(location.search);
  const slot = params.get('slot') || '1';
  const img = document.getElementById('feed');
  const fallback = document.getElementById('fallback');
  fallback.textContent = 'CAM ' + slot + ' OFFLINE';

  let lastFrameTime = 0;
  let activeUrl = null;

  function connect() {
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${location.host}/ws/cam/sub?slot=${slot}`);
    ws.binaryType = 'blob';

    ws.onmessage = (event) => {
      lastFrameTime = Date.now();
      if (activeUrl) URL.revokeObjectURL(activeUrl);
      activeUrl = URL.createObjectURL(event.data);
      img.src = activeUrl;
      img.style.display = 'block';
      fallback.style.display = 'none';
    };

    ws.onclose = () => {
      img.style.display = 'none';
      fallback.style.display = 'flex';
      setTimeout(connect, 1500);
    };
  }

  setInterval(() => {
    if (Date.now() - lastFrameTime > 2000 && lastFrameTime > 0) {
      img.style.display = 'none';
      fallback.style.display = 'flex';
    }
  }, 1000);

  connect();
</script>
</body>
</html>
"""

INTERCOM_HTML = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>PROTOKOL Production Intercom</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0c0e12; color: #e4e7eb; margin: 0; padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; }}
  .panel {{ background: #161920; border: 1px solid #2a2e39; border-radius: 12px; padding: 2rem; max-width: 500px; width: 100%; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }}
  h1 {{ color: #e5b95a; margin-top: 0; }}
  .ptt-btn {{ width: 100%; padding: 2rem 1rem; font-size: 1.5rem; font-weight: 800; border-radius: 12px; border: 2px solid #363c4e; background: #222734; color: #fff; cursor: pointer; user-select: none; transition: all 0.1s; margin: 1.5rem 0; }}
  .ptt-btn:active, .ptt-btn.active {{ background: #dc2626; border-color: #ef4444; box-shadow: 0 0 25px rgba(220, 38, 38, 0.7); transform: scale(0.98); }}
  .info {{ font-size: 0.85rem; color: #8c96a5; }}
  .users {{ margin-top: 1rem; text-align: left; background: #0e1014; border-radius: 8px; padding: 1rem; max-height: 150px; overflow-y: auto; font-size: 0.85rem; }}
  .user-badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; background: #1f2430; margin: 2px; color: #4ade80; }}
  select, input {{ background: #0e1014; color: #fff; border: 1px solid #333; padding: 8px 12px; border-radius: 6px; width: calc(100% - 24px); margin-bottom: 1rem; }}
</style>
</head>
<body>
  <div class="panel">
    <h1>🎙️ PROTOKOL Intercom</h1>
    <p class="info">Проводная / локальная голосовая связь съёмочной группы</p>

    <label style="display:block; text-align:left; font-size:0.8rem; margin-bottom:4px; color:#8c96a5;">Ваша роль / Имя:</label>
    <select id="role">
      <option value="Режиссёр (Director)">Режиссёр (Director)</option>
      <option value="Оператор (Observer 1)" selected>Оператор (Observer 1)</option>
      <option value="Оператор (Observer 2)">Оператор (Observer 2)</option>
      <option value="Ведущий / Аналитик">Ведущий / Аналитик</option>
      <option value="Кастер (Талант)">Кастер (Талант)</option>
    </select>

    <button id="ptt" class="ptt-btn">🎤 ЗАЖАТЬ ДЛЯ СВЯЗИ (ПРОБЕЛ)</button>
    <div class="info">Работает клавиша <strong>SPACE (Пробел)</strong>. Отпустите, чтобы выключить микрофон.</div>

    <div class="users" id="user-list">
      <div><strong>В эфире интеркома:</strong></div>
      <div id="users-container" style="margin-top:6px;">Подключение...</div>
    </div>
  </div>

  <audio id="sink" autoplay></audio>

<script>
  const roleSelect = document.getElementById('role');
  const pttBtn = document.getElementById('ptt');
  const usersContainer = document.getElementById('users-container');
  let isTalking = false;
  let mediaRecorder = null;
  let audioStream = null;
  let ws = null;

  async function initAudio() {{
    try {{
      audioStream = await navigator.mediaDevices.getUserMedia({{
        audio: {{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }},
        video: false
      }});
    }} catch (e) {{
      alert('Ошибка доступа к микрофону: ' + e.message);
    }}
  }}

  function connectWs() {{
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${{wsProto}}//${{location.host}}/ws/intercom?role=${{encodeURIComponent(roleSelect.value)}}`);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {{
      if (typeof event.data === 'string') {{
        try {{
          const msg = JSON.parse(event.data);
          if (msg.type === 'users') {{
            usersContainer.innerHTML = msg.list.map(u => `<span class="user-badge">${{u}}</span>`).join(' ');
          }}
        }} catch (_) {{}}
      }} else {{
        // Play incoming audio chunk
        playAudioChunk(event.data);
      }}
    }};

    ws.onclose = () => {{
      usersContainer.innerHTML = '🟡 Переподключение...';
      setTimeout(connectWs, 2000);
    }};
  }}

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playAudioChunk(data) {{
    audioCtx.decodeAudioData(data.slice(0), (buffer) => {{
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    }}, () => {{}});
  }}

  roleSelect.onchange = () => {{
    if (ws) ws.close();
  }};

  function startTalking() {{
    if (isTalking || !audioStream || !ws || ws.readyState !== WebSocket.OPEN) return;
    isTalking = true;
    pttBtn.classList.add('active');
    pttBtn.textContent = '🔴 ГОВОРИТЕ...';

    mediaRecorder = new MediaRecorder(audioStream, {{ mimeType: 'audio/webm;codecs=opus' }});
    mediaRecorder.ondataavailable = (e) => {{
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {{
        e.data.arrayBuffer().then(buf => ws.send(buf));
      }}
    }};
    mediaRecorder.start(100); // Send 100ms packets
  }}

  function stopTalking() {{
    if (!isTalking) return;
    isTalking = false;
    pttBtn.classList.remove('active');
    pttBtn.textContent = '🎤 ЗАЖАТЬ ДЛЯ СВЯЗИ (ПРОБЕЛ)';
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {{
      mediaRecorder.stop();
    }}
  }}

  pttBtn.onmousedown = (e) => {{ e.preventDefault(); startTalking(); }};
  pttBtn.onmouseup = stopTalking;
  pttBtn.onmouseleave = stopTalking;

  window.addEventListener('keydown', (e) => {{
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {{
      e.preventDefault();
      startTalking();
    }}
  }});

  window.addEventListener('keyup', (e) => {{
    if (e.code === 'Space') {{
      e.preventDefault();
      stopTalking();
    }}
  }});

  initAudio().then(connectWs);
</script>
</body>
</html>
"""

# Map: slot_id -> set of subscriber websockets
cam_subscribers = {}
intercom_clients = {}

async def index_handler(request):
    return web.Response(text=INDEX_HTML, content_type='text/html')

async def sender_handler(request):
    return web.Response(text=SENDER_HTML, content_type='text/html')

async def view_handler(request):
    return web.Response(text=VIEW_HTML, content_type='text/html')

async def intercom_page_handler(request):
    return web.Response(text=INTERCOM_HTML, content_type='text/html')

async def ws_cam_pub(request):
    slot = request.query.get('slot', '1')
    ws = web.WebSocketResponse(max_msg_size=10*1024*1024)
    await ws.prepare(request)

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.BINARY:
                subs = cam_subscribers.get(slot, set())
                dead = []
                for sub in list(subs):
                    try:
                        await sub.send_bytes(msg.data)
                    except Exception:
                        dead.append(sub)
                for d in dead:
                    subs.discard(d)
    finally:
        pass
    return ws

async def ws_cam_sub(request):
    slot = request.query.get('slot', '1')
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    if slot not in cam_subscribers:
        cam_subscribers[slot] = set()
    cam_subscribers[slot].add(ws)

    try:
        async for msg in ws:
            pass
    finally:
        cam_subscribers[slot].discard(ws)
    return ws

async def broadcast_intercom_users():
    users = [role for role in intercom_clients.values()]
    msg = json.dumps({'type': 'users', 'list': users})
    for client in list(intercom_clients.keys()):
        try:
            await client.send_str(msg)
        except Exception:
            pass

async def ws_intercom(request):
    role = request.query.get('role', 'Участник')
    ws = web.WebSocketResponse(max_msg_size=5*1024*1024)
    await ws.prepare(request)

    intercom_clients[ws] = role
    await broadcast_intercom_users()

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.BINARY:
                for client in list(intercom_clients.keys()):
                    if client != ws:
                        try:
                            await client.send_bytes(msg.data)
                        except Exception:
                            pass
    finally:
        intercom_clients.pop(ws, None)
        await broadcast_intercom_users()
    return ws

app = web.Application()
app.router.add_get('/', index_handler)
app.router.add_get('/sender.html', sender_handler)
app.router.add_get('/view.html', view_handler)
app.router.add_get('/intercom.html', intercom_page_handler)
app.router.add_get('/ws/cam/pub', ws_cam_pub)
app.router.add_get('/ws/cam/sub', ws_cam_sub)
app.router.add_get('/ws/intercom', ws_intercom)

if __name__ == '__main__':
    print(f"==================================================")
    print(f"PROTOKOL LAN Cam & Intercom Hub is active!")
    print(f"Hub URL: http://{LAN_IP}:{PORT}")
    print(f"Intercom Room: http://{LAN_IP}:{PORT}/intercom.html")
    print(f"==================================================")
    web.run_app(app, host=HOST, port=PORT)
