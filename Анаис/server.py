"""Serve the local CQA workspace and forward organizer dataset requests."""
import argparse
import json
import os
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen


def organizer_url(guide):
    if url := os.getenv("CQA_DEV_URL"):
        return url.strip()
    if not guide:
        dirs = [Path.home() / "Desktop", Path.home() / "OneDrive/Desktop", Path.cwd()]
        guide = next((p for d in dirs for p in sorted(d.glob("CQA_Hackathon_Student_Guide*.pdf"))), None)
    if not guide:
        raise ValueError("Задайте CQA_DEV_URL или путь к руководству через --guide.")
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ValueError("Для чтения ссылки из PDF установите pypdf или задайте CQA_DEV_URL.")
    try:
        for page in PdfReader(guide).pages:
            for annotation in page.get("/Annots", []):
                uri = annotation.get_object().get("/A", {}).get("/URI", "")
                if "group_id" in parse_qs(urlsplit(uri).query):
                    return uri
    except Exception:
        raise ValueError("Не удалось прочитать руководство. Проверьте путь к PDF.")
    raise ValueError("В руководстве отсутствует ссылка на набор.")


from model_api import assess
from workspace_store import read_workspace, write_workspace

class Workspace(SimpleHTTPRequestHandler):
    def do_POST(self):
        local = f"127.0.0.1:{self.server.server_port}"
        if (self.headers.get("Host") != local or self.headers.get("Origin") != "http://" + local
                or self.headers.get_content_type() != "application/json"):
            return self.json_response(403, {"error": "Откройте локальное приложение."})
        if self.path not in {"/api/assess", "/api/workspace"}:
            return self.json_response(404, {"error": "Неизвестный метод."})
        try:
            size = int(self.headers.get("Content-Length", 0))
            if not 0 < size <= (16000000 if self.path == "/api/workspace" else 512000):
                return self.json_response(413, {"error": "Слишком большой запрос."})
            data = json.loads(self.rfile.read(size))
            if self.path == "/api/workspace":
                status, result = write_workspace(data)
                return self.json_response(status, result)
            output = assess(data["record"], data["criteria"])
        except (KeyError, TypeError, ValueError) as exc:
            return self.json_response(400, {"error": str(exc)})
        except RuntimeError as exc:
            return self.json_response(502, {"error": str(exc)})
        self.json_response(200, output)
    def json_response(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        target = urlsplit(self.path)
        if target.path.startswith("/api/") and self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}":
            return self.json_response(403, {"error": "Недоступный адрес."})
        if target.path == "/api/workspace":
            return self.json_response(200, read_workspace())
        if target.path != "/api/dataset":
            return super().do_GET()
        group = parse_qs(target.query).get("group_id", ["DEV"])[0]
        if not re.fullmatch(r"[\w.\-]{1,100}", group):
            return self.json_response(400, {"isSuccess": False, "error": "Проверьте идентификатор группы."})
        try:
            parts = urlsplit(organizer_url(self.server.guide))
            if parts.scheme != "https" or not parts.hostname:
                raise ValueError("Адрес API должен начинаться с https://.")
            query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "group_id"]
            url = urlunsplit(parts._replace(query=urlencode(query + [("group_id", group)])))
            with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=30) as response:
                payload = json.load(response)
            if not isinstance(payload, dict) or not payload.get("isSuccess"):
                return self.json_response(502, {"isSuccess": False, "error": "Организатор не выдал набор. Проверьте group_id и срок действия ссылки."})
            records = payload.get("data", {}).get("records")
            if not isinstance(records, list):
                raise ValueError("В ответе API отсутствует массив records.")
            self.json_response(200, payload)
        except HTTPError as err:
            self.json_response(502, {"isSuccess": False, "error": f"API организатора вернул HTTP {err.code}."})
        except (URLError, OSError):
            self.json_response(502, {"isSuccess": False, "error": "Нет связи с API организатора. Можно импортировать JSON."})
        except (ValueError, TypeError, AttributeError) as err:
            self.json_response(400, {"isSuccess": False, "error": str(err)})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument("--guide", type=Path, help="Путь к руководству с GET-ссылкой")
    args = parser.parse_args()
    handler = partial(Workspace, directory=str(Path(__file__).resolve().parent))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        server.guide = args.guide
        print(f"http://127.0.0.1:{args.port}", flush=True)
        server.serve_forever()


