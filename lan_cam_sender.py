"""
LAN Cam Native Sender for PROTOKOL HUD
Direct OpenCV webcam streamer to PROTOKOL LAN Cam Hub (No browser permissions needed).
Usage:
    python lan_cam_sender.py --slot 1 --server 192.168.1.110:8090
"""
import sys
import time
import argparse
import cv2
import asyncio
import websockets

async def stream_webcam(slot, server, cam_index, width, height, fps, quality):
    ws_url = f"ws://{server}/ws/cam?slot={slot}"
    print(f"[*] Connecting to {ws_url} (Webcam #{cam_index})...")

    cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(cam_index)
    if not cap.isOpened():
        print(f"[!] Error: Could not open webcam index {cam_index}")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)

    delay = 1.0 / max(1, fps)

    while True:
        try:
            async with websockets.connect(ws_url) as ws:
                print(f"[+] Connected to hub! Streaming slot {slot} at ~{fps} FPS...")
                encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
                
                while True:
                    t0 = time.time()
                    ret, frame = cap.read()
                    if not ret:
                        await asyncio.sleep(0.05)
                        continue

                    # Encode to JPEG
                    _, buf = cv2.imencode('.jpg', frame, encode_param)
                    await ws.send(buf.tobytes())

                    elapsed = time.time() - t0
                    sleep_time = max(0.005, delay - elapsed)
                    await asyncio.sleep(sleep_time)
        except Exception as e:
            print(f"[-] Disconnected: {e}. Reconnecting in 2 seconds...")
            await asyncio.sleep(2)

def main():
    parser = argparse.ArgumentParser(description="PROTOKOL Native Webcam Streamer")
    parser.add_argument("--slot", type=int, default=1, help="Player slot 1..10")
    parser.add_argument("--server", type=str, default="127.0.0.1:8090", help="Hub address (e.g. 192.168.1.110:8090)")
    parser.add_argument("--cam", type=int, default=0, help="Camera index (default 0)")
    parser.add_argument("--width", type=int, default=1280, help="Frame width")
    parser.add_argument("--height", type=int, default=720, help="Frame height")
    parser.add_argument("--fps", type=int, default=30, help="Target FPS")
    parser.add_argument("--quality", type=int, default=70, help="JPEG quality 1..100")
    args = parser.parse_args()

    try:
        asyncio.run(stream_webcam(args.slot, args.server, args.cam, args.width, args.height, args.fps, args.quality))
    except KeyboardInterrupt:
        print("\n[*] Stopped by user.")

if __name__ == "__main__":
    main()
