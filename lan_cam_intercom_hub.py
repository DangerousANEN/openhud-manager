"""
PROTOKOL LAN Cam & Intercom Hub
Ultra-lightweight WebRTC / WebSocket video and audio comms hub.
Runs locally on the operator / director PC.

Supports both HTTP (:8090) and HTTPS (:8443) with auto-generated SSL certificate
so that browser webcam permissions (getUserMedia) work seamlessly over LAN.
"""

import asyncio
import datetime
import json
import os
import socket
import ssl
from aiohttp import web
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

HTTP_PORT = 8090
HTTPS_PORT = 8443

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

def ensure_ssl_certs():
    cert_path = os.path.join(os.path.dirname(__file__), 'hub_cert.pem')
    key_path = os.path.join(os.path.dirname(__file__), 'hub_key.pem')
    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, u'PROTOKOL-Hub'),
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow() - datetime.timedelta(days=1)
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    ).sign(key, hashes.SHA256())

    with open(key_path, 'wb') as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))
    with open(cert_path, 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    return cert_path, key_path

INDEX_HTML = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>PROTOKOL LAN Cam & Intercom</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0c0e12; color: #e4e7eb; margin: 0; padding: 2rem; }}
  h1 {{ color: #e5b95a; margin-bottom: 0.5rem; }}
  p {{ color: #8c96a5; }}
  .card {{ background: #161920; border: 1px solid #2a2e39; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; max-width: 820px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem; }}
  .btn {{ display: block; text-align: center; background: #1e222d; border: 1px solid #363c4e; color: #fff; padding: 0.75rem 1rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }}
  .btn:hover {{ background: #e5b95a; color: #000; border-color: #e5b95a; }}
  .btn-gold {{ background: #e5b95a; color: #000; font-weight: bold; border-color: #e5b95a; }}
  .btn-gold:hover {{ background: #dfa836; }}
  .badge {{ display: inline-block; background: #e5b95a22; color: #e5b95a; border: 1px solid #e5b95a44; font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; font-family: monospace; }}
  .warn {{ background: rgba(220, 38, 38, 0.15); border: 1px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin: 12px 0; color: #fca5a5; font-size: 0.88rem; }}
</style>
</head>
<body>
  <h1>PROTOKOL LAN Cam & Intercom Hub</h1>
  <p>Локальный сервер трансляции веб-камер и служебной голосовой связи (интерком) для турниров CS2.</p>
  <p>
    Адрес хоста HTTP: <span class="badge">http://{LAN_IP}:{HTTP_PORT}</span> &nbsp;|&nbsp; 
    HTTPS (для вебок): <span class="badge">https://{LAN_IP}:{HTTPS_PORT}</span>
  </p>

  <div class="card">
    <h2>📹 Веб-камеры игроков (Отправка с ПК игрока)</h2>
    <div class="warn">
      <strong>Важно для Chrome/Edge:</strong> Браузеры разрешают доступ к веб-камере по сети ТОЛЬКО через защищенное соединение <strong>HTTPS</strong>.<br>
      Открывайте ссылки ниже на ПК игрока через <strong>HTTPS</strong> (при первом открытии нажмите <em>«Дополнительно» → «Перейти на сайт»</em>).
    </div>
    <p>Выберите слот для каждого игрока:</p>
    <div class="grid">
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=1" target="_blank">Слот 1 (Игрок 1)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=2" target="_blank">Слот 2 (Игрок 2)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=3" target="_blank">Слот 3 (Игрок 3)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=4" target="_blank">Слот 4 (Игрок 4)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=5" target="_blank">Слот 5 (Игрок 5)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=6" target="_blank">Слот 6 (Игрок 6)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=7" target="_blank">Слот 7 (Игрок 7)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=8" target="_blank">Слот 8 (Игрок 8)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=9" target="_blank">Слот 9 (Игрок 9)</a>
      <a class="btn btn-gold" href="https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=10" target="_blank">Слот 10 (Игрок 10)</a>
    </div>
  </div>

  <div class="card">
    <h2>📺 Ссылки для PROTOKOL HUD Manager / OBS</h2>
    <p>Вставляйте эти ссылки в раздел <strong>«Веб-камеры»</strong> программы напротив SteamID игрока (тип <strong>iframe</strong>):</p>
    <div class="grid">
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=1" target="_blank">Слот 1 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=2" target="_blank">Слот 2 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=3" target="_blank">Слот 3 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=4" target="_blank">Слот 4 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=5" target="_blank">Слот 5 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=6" target="_blank">Слот 6 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=7" target="_blank">Слот 7 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=8" target="_blank">Слот 8 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=9" target="_blank">Слот 9 View</a>
      <a class="btn" href="http://{LAN_IP}:{HTTP_PORT}/view.html?slot=10" target="_blank">Слот 10 View</a>
    </div>
  </div>

  <div class="card">
    <h2>🎙️ Служебная голосовая связь (Intercom)</h2>
    <p>Связь между режиссёром, оператором и кастерами без задержки по локальной сети.</p>
    <a class="btn btn-gold" style="max-width:320px;" href="https://{LAN_IP}:{HTTPS_PORT}/intercom.html" target="_blank">Открыть пульт Интеркома (Push-to-Talk)</a>
  </div>
</body>
</html>
"""

SENDER_HTML = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>PROTOKOL Cam Sender</title>
<style>
  body {{ background: #0c0e12; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }}
  .box {{ background: #161920; border: 1px solid #2a2e39; border-radius: 12px; padding: 2rem; max-width: 680px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }}
  h2 {{ color: #e5b95a; margin-top: 0; }}
  video {{ width: 100%; max-width: 560px; height: 315px; background: #000; border: 2px solid #e5b95a; border-radius: 8px; transform: scaleX(-1); margin-top: 1rem; }}
  .status {{ margin-top: 1.2rem; font-weight: bold; font-size: 1.1rem; color: #8c96a5; }}
  select {{ background: #0e1014; color: #fff; border: 1px solid #444; padding: 10px 14px; border-radius: 6px; font-size: 1rem; width: 100%; max-width: 560px; margin-top: 1rem; }}
  .btn-action {{ background: #e5b95a; color: #000; font-weight: bold; font-size: 1.1rem; border: none; padding: 14px 28px; border-radius: 8px; cursor: pointer; margin-top: 1rem; transition: transform 0.1s; }}
  .btn-action:hover {{ background: #dfa836; transform: scale(1.02); }}
  .warn-banner {{ background: rgba(220, 38, 38, 0.2); border: 1px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin-bottom: 1rem; text-align: left; font-size: 0.9rem; line-height: 1.4; color: #fca5a5; display: none; }}
  .help-link {{ color: #e5b95a; text-decoration: underline; font-weight: bold; }}
</style>
</head>
<body>
  <div class="box">
    <h2 id="title">Веб-камера игрока</h2>

    <div id="warn-banner" class="warn-banner"></div>

    <button id="btn-start" class="btn-action">📹 РАЗРЕШИТЬ И ЗАПУСТИТЬ ВЕБ-КАМЕРУ</button>

    <div id="cam-controls" style="display:none;">
      <label style="display:block; text-align:left; max-width:560px; margin:1rem auto 0.2rem auto; font-size:0.85rem; color:#8c96a5;">Выберите веб-камеру из списка:</label>
      <select id="cam-select"></select>
    </div>

    <video id="preview" autoplay muted playsinline style="display:none;"></video>
    <div class="status" id="status">Нажмите кнопку выше для выдачи разрешения браузеру</div>
  </div>

<script>
  const params = new URLSearchParams(location.search);
  const slot = params.get('slot') || '1';
  document.getElementById('title').textContent = 'Веб-камера: Слот ' + slot;

  const btnStart = document.getElementById('btn-start');
  const camControls = document.getElementById('cam-controls');
  const camSelect = document.getElementById('cam-select');
  const video = document.getElementById('preview');
  const statusEl = document.getElementById('status');
  const warnBanner = document.getElementById('warn-banner');

  let stream = null;
  let ws = null;

  // Check Secure Context
  const isSecure = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure && location.protocol !== 'https:') {{
    warnBanner.style.display = 'block';
    const httpsUrl = 'https://' + location.hostname + ':{HTTPS_PORT}' + location.pathname + location.search;
    warnBanner.innerHTML = '⚠️ <strong>Браузер блокирует доступ к камере по обычному HTTP!</strong><br>' +
      'Пожалуйста, откройте страницу через защищенный HTTPS протокол:<br>' +
      '<a class="help-link" href="' + httpsUrl + '">👉 НАЖМИТЕ СЮДА, ЧТОБЫ ПЕРЕЙТИ НА HTTPS (' + httpsUrl + ')</a><br>' +
      '<small style="color:#ccc;">(В появившемся предупреждении нажмите "Дополнительно" -> "Перейти на сайт")</small>';
  }}

  async function populateDevices() {{
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    camSelect.innerHTML = '';
    videoDevices.forEach((d, i) => {{
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || ('Веб-камера ' + (i + 1));
      camSelect.appendChild(opt);
    }});
    if (videoDevices.length > 0) {{
      camControls.style.display = 'block';
    }}
  }}

  async function startCam(deviceId) {{
    if (stream) stream.getTracks().forEach(t => t.stop());
    const constraints = {{
      video: deviceId ? {{ deviceId: {{ exact: deviceId }}, width: 1280, height: 720, frameRate: 30 }} : {{ width: 1280, height: 720, frameRate: 30 }},
      audio: false
    }};
    try {{
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;
      video.style.display = 'block';
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '🟢 В ЭФИРЕ: Камера запущена и стримится на сервер (Слот ' + slot + ')';
      await populateDevices();
      startStreaming();
    }} catch (e) {{
      statusEl.style.color = '#ef4444';
      statusEl.textContent = '❌ Ошибка камеры: ' + e.message;
    }}
  }}

  btnStart.onclick = async () => {{
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {{
      alert('Ваш браузер не поддерживает доступ к медиаустройствам. Убедитесь, что страница открыта по HTTPS или с localhost.');
      return;
    }}
    btnStart.style.display = 'none';
    statusEl.textContent = 'Запрос доступа к камере...';
    await startCam();
  }};

  camSelect.onchange = () => startCam(camSelect.value);

  function startStreaming() {{
    if (ws) {{ try {{ ws.close(); }} catch(_) {{}} }}
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${{wsProto}}//${{location.host}}/ws/cam/pub?slot=${{slot}}`);
    
    ws.onopen = () => {{
      statusEl.style.color = '#4ade80';
      statusEl.textContent = '🟢 В ЭФИРЕ: Поток передается оператору (Слот ' + slot + ')';
    }};
    ws.onclose = () => {{
      statusEl.style.color = '#eab308';
      statusEl.textContent = '🟡 Переподключение к хабу...';
      setTimeout(startStreaming, 2000);
    }};

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    setInterval(() => {{
      if (ws && ws.readyState === WebSocket.OPEN && video.readyState >= 2) {{
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {{
          if (blob && ws.readyState === WebSocket.OPEN) {{
            ws.send(blob);
          }}
        }}, 'image/jpeg', 0.68);
      }}
    }}, 33);
  }}

  // If already granted, auto start
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {{
    navigator.mediaDevices.enumerateDevices().then(devices => {{
      const hasLabels = devices.some(d => d.kind === 'videoinput' && d.label);
      if (hasLabels) {{
        btnStart.click();
      }}
    }}).catch(() => {{}});
  }}
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
  select {{ background: #0e1014; color: #fff; border: 1px solid #333; padding: 8px 12px; border-radius: 6px; width: 100%; margin-bottom: 1rem; }}
  .warn-banner {{ background: rgba(220, 38, 38, 0.2); border: 1px solid #ef4444; border-radius: 8px; padding: 10px; margin-bottom: 1rem; text-align: left; font-size: 0.85rem; color: #fca5a5; display: none; }}
</style>
</head>
<body>
  <div class="panel">
    <h1>🎙️ PROTOKOL Intercom</h1>
    <div id="warn-banner" class="warn-banner"></div>
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
  const warnBanner = document.getElementById('warn-banner');

  const isSecure = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure && location.protocol !== 'https:') {{
    warnBanner.style.display = 'block';
    const httpsUrl = 'https://' + location.hostname + ':{HTTPS_PORT}' + location.pathname + location.search;
    warnBanner.innerHTML = '⚠️ Микрофон требует HTTPS. Перейдите по ссылке: <a style="color:#e5b95a;" href="' + httpsUrl + '">' + httpsUrl + '</a>';
  }}

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
      console.warn('Microphone permission not granted yet:', e);
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

  async function startTalking() {{
    if (isTalking) return;
    if (!audioStream) {{
      await initAudio();
    }}
    if (!audioStream || !ws || ws.readyState !== WebSocket.OPEN) return;

    isTalking = true;
    pttBtn.classList.add('active');
    pttBtn.textContent = '🔴 ГОВОРИТЕ...';

    try {{
      mediaRecorder = new MediaRecorder(audioStream, {{ mimeType: 'audio/webm;codecs=opus' }});
      mediaRecorder.ondataavailable = (e) => {{
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {{
          e.data.arrayBuffer().then(buf => ws.send(buf));
        }}
      }};
      mediaRecorder.start(100);
    }} catch (e) {{
      console.error('MediaRecorder error:', e);
      stopTalking();
    }}
  }}

  function stopTalking() {{
    if (!isTalking) return;
    isTalking = false;
    pttBtn.classList.remove('active');
    pttBtn.textContent = '🎤 ЗАЖАТЬ ДЛЯ СВЯЗИ (ПРОБЕЛ)';
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {{
      try {{ mediaRecorder.stop(); }} catch(_) {{}}
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

def create_app():
    app = web.Application()
    app.router.add_get('/', index_handler)
    app.router.add_get('/sender.html', sender_handler)
    app.router.add_get('/view.html', view_handler)
    app.router.add_get('/intercom.html', intercom_page_handler)
    app.router.add_get('/ws/cam/pub', ws_cam_pub)
    app.router.add_get('/ws/cam/sub', ws_cam_sub)
    app.router.add_get('/ws/intercom', ws_intercom)
    return app

async def main():
    cert_path, key_path = ensure_ssl_certs()
    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    ssl_context.load_cert_chain(cert_path, key_path)

    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()

    # HTTP site (for OBS / Manager iframes)
    site_http = web.TCPSite(runner, '0.0.0.0', HTTP_PORT)
    await site_http.start()

    # HTTPS site (for browser webcams and microphones over LAN)
    site_https = web.TCPSite(runner, '0.0.0.0', HTTPS_PORT, ssl_context=ssl_context)
    await site_https.start()

    print(f"==================================================")
    print(f"PROTOKOL LAN Cam & Intercom Hub is active!")
    print(f"HTTP Hub URL:  http://{LAN_IP}:{HTTP_PORT}")
    print(f"HTTPS Hub URL: https://{LAN_IP}:{HTTPS_PORT}")
    print(f"Cam Sender:    https://{LAN_IP}:{HTTPS_PORT}/sender.html?slot=1")
    print(f"Intercom Room: https://{LAN_IP}:{HTTPS_PORT}/intercom.html")
    print(f"==================================================")

    # Keep running forever
    while True:
        await asyncio.sleep(3600)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
