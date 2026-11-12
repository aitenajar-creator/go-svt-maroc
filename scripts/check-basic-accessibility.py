#!/usr/bin/env python3
"""Static accessibility guard for image alternatives and form-control names."""
from html.parser import HTMLParser
from pathlib import Path
import sys

class AccessibilityParser(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path
        self.errors = []
        self.button_stack = []
        self.label_depth = 0
        self.label_for = set()
        self.controls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "label":
            self.label_depth += 1
            if attrs.get("for"):
                self.label_for.add(attrs["for"])
        if tag == "img" and "alt" not in attrs:
            self.errors.append(f"{self.path}: image is missing an alt attribute")
        if tag == "input" and attrs.get("type", "").lower() == "image" and "alt" not in attrs:
            self.errors.append(f"{self.path}: image input is missing an alt attribute")
        if tag in ("input", "select", "textarea"):
            kind = attrs.get("type", "").lower()
            if not (tag == "input" and kind in ("hidden", "submit", "button", "reset")):
                self.controls.append({
                    "id": attrs.get("id"),
                    "named": bool((attrs.get("aria-label") or "").strip() or
                                  (attrs.get("aria-labelledby") or "").strip() or
                                  (attrs.get("title") or "").strip()),
                    "inside_label": self.label_depth > 0,
                })
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
        if tag == "label" and self.label_depth:
            self.label_depth -= 1

    def validate_controls(self):
        for control in self.controls:
            associated = control["inside_label"] or (
                control["id"] and control["id"] in self.label_for
            )
            if not control["named"] and not associated:
                self.errors.append(
                    f"{self.path}: form control {control['id'] or '(without id)'} has no accessible label"
                )

errors = []
pages = sorted(Path(".").rglob("*.html"))
for page in pages:
    parser = AccessibilityParser(page.as_posix())
    parser.feed(page.read_text(encoding="utf-8"))
    parser.validate_controls()
    errors.extend(parser.errors)

if errors:
    print("Basic accessibility checks failed:")
    print("\n".join(f"- {error}" for error in errors))
    sys.exit(1)

print(f"Basic accessibility checks passed across {len(pages)} HTML pages.")
