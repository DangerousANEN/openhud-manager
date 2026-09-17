"""Minimal WS probe: connect to the live server, send ONE planted-bomb GSI
packet through the existing fixture helper, print the real incoming keys."""
import asyncio, json, urllib.request
from pathlib import Path

ns = {}
exec(Path(__file__).with_name('camera_e2e.py').read_text().split('packs=[')[0], ns)

async def main():
    import websockets
    async with websockets.connect('ws://127.0.0.1:1349/ws') as ws:
        await asyncio.sleep(0.5)
        body = ns['packet']()
        body['round']['phase'] = 'bomb'
        body['phase_countdowns'] = {'phase': 'bomb', 'phase_ends_in': '17.4'}
        body['bomb'] = {'state': 'planted', 'position': '-1500, 300, 0', 'countdown': '17.4'}
        req = urllib.request.Request(ns['BASE'] + '/api/gsi',
                                     data=json.dumps(body).encode(),
                                     headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=5) as r:
            print('POST /api/gsi ->', r.status)
        for i in range(3):
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=3)
            except asyncio.TimeoutError:
                print('no more frames'); break
            m = json.loads(raw)
            print(f'FRAME {i} KEYS:', sorted(m.keys()))
            for k in ('bomb', 'bomb_state', 'bomb_countdown', 'round_time', 'phase'):
                print(f'  top.{k} =', repr(m.get(k)))
            snap = m.get('snapshot') or {}
            print('  snapshot.bomb/bomb_state/bomb_countdown =',
                  repr(snap.get('bomb')), repr(snap.get('bomb_state')), repr(snap.get('bomb_countdown')))
            if m.get('data'):
                print('  data keys:', sorted(m['data'].keys())[:12])

asyncio.run(main())
print('PROBE-DONE')
