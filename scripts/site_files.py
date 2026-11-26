"""Iterate application files without dependencies, test fixtures or generated output."""
from pathlib import Path
import os

EXCLUDED = {"node_modules", "design-upgrade-v2", "tests", "test-results", "playwright-report", "_site", "__pycache__", ".git", ".jekyll-cache"}

def site_files(root, suffix=None):
    root = Path(root)
    for directory, dirs, names in os.walk(root):
        dirs[:] = sorted(name for name in dirs if name not in EXCLUDED and not name.startswith("."))
        for name in sorted(names):
            if name.startswith(".") or name == "config.local.json":
                continue
            path = Path(directory) / name
            if suffix is None or path.suffix == suffix:
                yield path
