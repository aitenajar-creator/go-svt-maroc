#!/usr/bin/env python3
"""Local source preview. Auth is disabled unless config.local.json selects test projects."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit
from site_files import EXCLUDED, site_files

ROOT = Path(__file__).resolve().parents[1]
CONTENT = {"cours", "exercices", "examens", "fiches", "resumes", "documents", "ressources", "divers", "quiz"}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def reply(self, body, content_type):
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip("/")
        parts = Path(path).parts
        if any(part.startswith(".") or part in EXCLUDED or part == "supabase" for part in parts) or path in {"config.local.json", "package-lock.json"}:
            self.send_error(404)
            return
        if path == "content.json":
            paths = ["/" + str(file.relative_to(ROOT)).replace("\\", "/") for file in site_files(ROOT)
                     if file.relative_to(ROOT).parts[0] in CONTENT and file.name.lower() != "readme.md"]
            self.reply(json.dumps(paths, ensure_ascii=False), "application/json; charset=utf-8")
            return
        if path in {"supabase-config.js", "teacher-community-config.js"}:
            config_path = ROOT / "config.local.json"
            config = json.loads(config_path.read_text()) if config_path.exists() else {}
            public_config = {key: config.get(key, "") for key in (
                "supabaseUrl", "supabasePublishableKey", "teacherSupabaseUrl", "teacherSupabasePublishableKey")}
            prefix = "window.GoSVTRuntimeConfig=" + json.dumps(public_config) + ";\n"
            self.reply(prefix + (ROOT / path).read_text(), "application/javascript; charset=utf-8")
            return
        super().do_GET()
    def do_HEAD(self):
        self.do_GET()
    def list_directory(self, path):
        self.send_error(404)
        return None
    def log_message(self, format, *args):
        if not getattr(self.server, 'quiet', False):
            super().log_message(format, *args)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    print(f"Local preview: http://{args.host}:{args.port} (production authentication disabled by default)", flush=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.quiet = args.quiet
    server.serve_forever()
