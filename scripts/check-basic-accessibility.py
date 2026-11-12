#!/usr/bin/env python3
"""Basic accessibility guard for static HTML: image alternatives and button names."""
from html.parser import HTMLParser
from pathlib import Path
import sys

class AccessibilityParser(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path
        self.errors = []
        self.button_stack = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "img" and "alt" not in attrs:
            self.errors.append(f"{self.path}: image is missing an alt attribute")
        if tag == "input" and attrs.get("type", "").lower() == "image" and "alt" not in attrs:
            self.errors.append(f"{self.path}: image input is missing an alt attribute")
        if tag == "button":
            self.button_stack.append({
                "named": bool((attrs.get("aria-label") or "").strip() or
                              (attrs.get("title") or "").strip()),
                "text": False,
            })

    def handle_data(self, data):
        if self.button_stack and data.strip():
            self.button_stack[-1]["text"] = True

    def handle_endtag(self, tag):
        if tag == "button" and self.button_stack:
            button = self.button_stack.pop()
            if not button["named"] and not button["text"]:
                self.errors.append(f"{self.path}: button has no accessible name")

errors = []
pages = sorted(Path(".").rglob("*.html"))
for page in pages:
    parser = AccessibilityParser(page.as_posix())
    parser.feed(page.read_text(encoding="utf-8"))
    errors.extend(parser.errors)

if errors:
    print("Basic accessibility checks failed:")
    print("\n".join(f"- {error}" for error in errors))
    sys.exit(1)

print(f"Basic accessibility checks passed across {len(pages)} HTML pages.")
