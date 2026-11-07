"""Launch a loopback-only workspace on an available port."""
import json
import os
import webbrowser
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.request import build_opener, ProxyHandler
from server import Workspace

root = Path(__file__).resolve().parent
state = Path(os.getenv("LOCALAPPDATA") or Path.home()) / "AnaisCQA-port.txt"
try:
    port = int(state.read_text())
except (OSError, ValueError):
    port = 18761
try:
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Workspace, directory=str(root)))
except OSError:
    url = f"http://127.0.0.1:{port}"
    try:
        with build_opener(ProxyHandler({})).open(url + "/index.html", timeout=2) as response:
            existing = b"engine.js" in response.read(12000)
    except OSError:
        existing = False
    if existing:
        webbrowser.open(url)
        raise SystemExit
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Workspace, directory=str(root)))
server.guide = None
port = server.server_port
state.write_text(str(port))
url = f"http://127.0.0.1:{port}"
print(url, flush=True)
webbrowser.open(url)
server.serve_forever()
