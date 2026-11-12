#!/usr/bin/env python3
"""SEO and indexing safety checks for public and private static pages."""
from pathlib import Path
import re
import sys

errors = []
home = Path("index.html").read_text(encoding="utf-8")
checks = {
    "homepage title": r"<title\b[^>]*>[^<]+\S[^<]*</title>",
    "homepage description": r'<meta\s+name=["\']description["\']\s+content=["\'][^"\']+\s*["\']',
    "homepage canonical": r'<link\s+rel=["\']canonical["\']\s+href=["\']https://gosvtmaroc\.com/["\']',
    "Open Graph title": r'<meta\s+property=["\']og:title["\']',
    "Open Graph image": r'<meta\s+property=["\']og:image["\']',
    "mobile viewport": r'<meta\s+name=["\']viewport["\']',
}
for label, pattern in checks.items():
    if not re.search(pattern, home, re.IGNORECASE):
        errors.append(f"index.html: missing {label}")

for name in ("admin.html", "teacher-community.html", "test-runner.html"):
    page = Path(name)
    if not page.exists():
        errors.append(f"Missing expected page: {name}")
        continue
    html = page.read_text(encoding="utf-8")
    if not re.search(
        r'<meta\s+name=["\']robots["\']\s+content=["\']noindex\s*,\s*nofollow["\']',
        html,
        re.IGNORECASE,
    ):
        errors.append(f"{name}: private page must be noindex, nofollow")

if errors:
    print("SEO/indexing checks failed:")
    print("\n".join(f"- {item}" for item in errors))
    sys.exit(1)

print("SEO and private-page indexing checks passed.")
