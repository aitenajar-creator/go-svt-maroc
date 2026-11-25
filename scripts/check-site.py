#!/usr/bin/env python3
"""Check source/built JSON, script syntax, asset paths and mandatory load order."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlsplit
from site_files import site_files

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.assets = []
        self.inline = []
        self.script = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            if attrs.get("src"):
                self.assets.append(("script", attrs["src"]))
            elif attrs.get("type", "").lower() in ("", "text/javascript", "application/javascript", "module"):
                self.script = [attrs.get("type", ""), ""]
        elif tag == "link" and "stylesheet" in attrs.get("rel", "").split() and attrs.get("href"):
            self.assets.append(("stylesheet", attrs["href"]))
    def handle_data(self, data):
        if self.script is not None:
            self.script[1] += data
    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.inline.append(self.script)
            self.script = None

def check(root, built=False):
    root = Path(root).resolve()
    failures = []
    if not (root / "index.html").is_file():
        return [f"Missing application entrypoint: {root}/index.html"]
    files = list(site_files(root))
    for path in files:
        if path.suffix == ".json" and (built or path.name != "content.json"):
            try:
                json.loads(path.read_text(encoding="utf-8"))
            except (ValueError, UnicodeError) as error:
                failures.append(f"{path.relative_to(root)}: invalid JSON: {error}")
        if path.suffix == ".js":
            result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
            if result.returncode:
                failures.append(f"{path.relative_to(root)}: {result.stderr.strip()}")
    for page in (path for path in files if path.suffix == ".html"):
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        for kind, url in parser.assets:
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            clean = unquote(parsed.path)
            target = (root / clean.lstrip("/") if clean.startswith("/") else page.parent / clean).resolve()
            if not target.is_relative_to(root) or not target.is_file():
                failures.append(f"{page.relative_to(root)}: missing {kind}: {url}")
        for number, (kind, code) in enumerate(parser.inline, 1):
            command = ["node", "--check"]
            if kind == "module":
                command += ["--input-type=module"]
            result = subprocess.run(command, input=code, text=True, capture_output=True)
            if result.returncode:
                failures.append(f"{page.relative_to(root)}: inline script {number}: {result.stderr.strip()}")
        if page == root / "index.html":
            ordered = [urlsplit(url).path.lstrip("./") for kind, url in parser.assets if kind == "script"]
            for before, after in (("student-space.js", "student-account.js"), ("student-account.js", "student-space-continue.js")):
                if before not in ordered or after not in ordered:
                    failures.append(f"index.html: required scripts missing: {before}, {after}")
                elif ordered.index(before) >= ordered.index(after):
                    failures.append(f"index.html: {before} must precede {after}")
    return failures

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--built", action="store_true")
    args = parser.parse_args()
    failures = check(args.root, args.built)
    if failures:
        raise SystemExit("Site validation failed:\n" + "\n".join(failures))
    print("Site JSON, JavaScript (including inline scripts), asset paths and script order passed.")
