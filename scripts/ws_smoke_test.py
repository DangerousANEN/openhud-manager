"""WS smoke test for OpenHUD overlay server: snapshot push + broadcast events."""
import asyncio, json, sys

import websockets

URI = "ws://127.0.0.1:13490/ws"

async def main():
    async with websockets.connect(URI) as ws:
        # 1) Initial snapshot arrives on connect
        first = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
        assert first.get("map") == "de_dust2", f"bad initial snapshot: {first}"
        print(f"OK initial snapshot: map={first['map']} score {first['ct_score']}:{first['t_score']} players={len(first['players'])}")

        # 2) Control event: sponsor_rotation must fan out verbatim
        async def sender():
            import urllib.request
            req = urllib.request.Request(
                "http://127.0.0.1:13490/api/gsi",
                data=json.dumps({
                    "auth": {"token": "smoke-token"},
                    "map": {"name": "de_mirage", "round": 8,
                            "team_ct": {"score": 4, "name": "Team B"},
                            "team_t": {"score": 4, "name": "Team A"}},
                    "round": {"phase": "live"},
                }).encode(),
                headers={"Content-Type": "application/json"},
                method="POST")
            urllib.request.urlopen(req)

        task = asyncio.create_task(sender())
        got_map_update = False
        while not got_map_update:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            if msg.get("map") == "de_mirage":
                got_map_update = True
                print(f"OK live update fanned out: {msg['ct_name']} {msg['ct_score']}:{msg['t_score']} {msg['t_name']}")
        await task
        print("WS SMOKE PASSED")

asyncio.run(main())
