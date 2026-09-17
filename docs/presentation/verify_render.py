#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_render.py
Validates the rendering of both:
  1. PPTX presentation (protokol-presentation.pptx) via LibreOffice Impress + pdftoppm
  2. HTML presentation (index.html) via Headless Chrome screenshots
Runs in the Developer-sandbox Linux environment without host GUI.
"""

import os
import subprocess
import sys
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PPTX_FILE = os.path.join(BASE_DIR, "protokol-presentation.pptx")
HTML_FILE = os.path.join(BASE_DIR, "index.html")

def run_cmd(cmd):
    p = subprocess.run(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()

def main():
    print("=== PROTOKOL PRESENTATION VERIFICATION ===")
    
    # 1. Regenerate PPTX
    print("\n1. Generating PPTX presentation...")
    ret, out, err = run_cmd(f'uv run --with python-pptx python "{os.path.join(BASE_DIR, "generate_presentation.py")}" "{PPTX_FILE}"')
    if ret != 0:
        print(f"Error generating PPTX: {err}")
        return 1
    print(f"PPTX generated successfully ({os.path.getsize(PPTX_FILE):,} bytes)")

    # 2. Render PPTX via Docker Developer-sandbox
    print("\n2. Rendering PPTX to PDF and PNGs in Linux sandbox...")
    docker_cmd = (
        'docker exec Developer-sandbox sh -c "'
        'cd /home/kasm-user/projects/protokol-presentation && '
        'mkdir -p render_pptx && '
        'soffice --headless --convert-to pdf protokol-presentation.pptx --outdir render_pptx && '
        'pdftoppm -png -r 150 render_pptx/protokol-presentation.pdf render_pptx/slide && '
        'ls -1 render_pptx/*.png | wc -l"'
    )
    ret, out, err = run_cmd(docker_cmd)
    if ret != 0:
        print(f"Docker PPTX render failed: {err}")
        return 1
    print(f"PPTX slides rendered: {out} slides generated in render_pptx/")

    # 3. Render HTML presentation via Chrome headless
    print("\n3. Rendering HTML slides (1-10) via Headless Chrome in Linux sandbox...")
    docker_html_cmd = (
        'docker exec Developer-sandbox sh -c "'
        'cd /home/kasm-user/projects/protokol-presentation && '
        'mkdir -p render_html && '
        'for i in $(seq 1 10); do '
        '  google-chrome --headless --no-sandbox --disable-gpu '
        '    --screenshot=\\"render_html/html-slide-$(printf \\"%02d\\" $i).png\\" '
        '    --window-size=1920,1080 \\"file://$(pwd)/index.html#$i\\" > /dev/null 2>&1; '
        'done && '
        'ls -1 render_html/*.png | wc -l"'
    )
    ret, out, err = run_cmd(docker_html_cmd)
    if ret != 0:
        print(f"Docker HTML render failed: {err}")
        return 1
    print(f"HTML slides captured: {out} viewports in render_html/")

    print("\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===")
    return 0

if __name__ == "__main__":
    sys.exit(main())
