#!/usr/bin/env python3
"""Stamp the built service worker with a deterministic application-shell hash."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

class ShellParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = {"/", "/index.html", "/offline.html", "/manifest.webmanifest", "/favicon.ico"}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        url = attrs.get("src") if tag == "script" else attrs.get("href") if tag == "link" and "stylesheet" in attrs.get("rel", "").split() else None
        if url and not urlsplit(url).scheme and not url.startswith("//"):
            self.paths.add("/" + urlsplit(url).path.lstrip("/"))

def build(root):
    root = Path(root)
    parser = ShellParser()
    parser.feed((root / "index.html").read_text())
    for asset in (root / 'assets/student-platform').rglob('*'):
        if asset.is_file() and asset.suffix.lower() in {'.webp', '.woff2', '.css', '.json'}:
            parser.paths.add('/' + asset.relative_to(root).as_posix())
    if (root / 'student-platform-catalog.json').is_file():
        parser.paths.add('/student-platform-catalog.json')
    worker = root / "sw.js"
    text = worker.read_text()
    canonical = re.sub(r"const RELEASE = '[^']+';", "const RELEASE = '<release>';", text)
    canonical = re.sub(r"const APP_SHELL = \[[\s\S]*?\];", "const APP_SHELL = [];", canonical, count=1)
    digest = hashlib.sha256(canonical.encode())
    for path in sorted(parser.paths):
        file = root / (path.lstrip("/") or "index.html")
        digest.update(path.encode())
        digest.update(file.read_bytes())
    text, count = re.subn(r"const RELEASE = '[^']+';", "const RELEASE = '" + digest.hexdigest()[:20] + "';", text)
    if count != 1:
        raise SystemExit("Service-worker release marker missing or duplicated")
    text, count = re.subn(r"const APP_SHELL = \[[\s\S]*?\];", "const APP_SHELL = " + json.dumps(sorted(parser.paths), indent=2) + ";", text, count=1)
    if count != 1:
        raise SystemExit("Service-worker shell marker missing")
    worker.write_text(text)
    print("Service-worker release:", digest.hexdigest()[:20], "assets:", len(parser.paths))

if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "_site")
