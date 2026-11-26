#!/usr/bin/env python3
"""Validate the generated student catalog and every local resource reference."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

TRACKS = {
    "TC": {"TCS", "TCL"},
    "1BAC": {"1BACSE", "1BACSM", "1BACL"},
    "2BAC": {"2BACSVT", "2BACSP", "2BACSM"},
}
KINDS = {"cours", "exercices", "examens", "fiches", "resumes", "quiz"}

def fail(message):
    raise SystemExit("Student catalog validation failed: " + message)

def resolve(root, public_path, label):
    if not isinstance(public_path, str) or not public_path.startswith("/"):
        fail(f"{label}: expected an absolute site path")
    relative = Path(public_path.lstrip("/"))
    if ".." in relative.parts:
        fail(f"{label}: path traversal is not allowed")
    target = root / relative
    if not target.is_file():
        fail(f"{label}: missing file {public_path}")
    return target

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".", help="Repository root or built Pages directory")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    catalog_path = root / "student-platform-catalog.json"
    if not catalog_path.is_file():
        fail("student-platform-catalog.json is missing")
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"catalog is not valid UTF-8 JSON: {error}")
    if catalog.get("version") != 1 or not isinstance(catalog.get("resources"), list):
        fail("unsupported catalog structure")

    resources = catalog["resources"]
    ids, paths = set(), set()
    counts = Counter()
    for index, item in enumerate(resources):
        label = f"resource[{index}]"
        if not isinstance(item, dict):
            fail(f"{label}: expected an object")
        resource_id = item.get("id")
        public_path = item.get("path")
        kind = item.get("type")
        if not isinstance(resource_id, str) or not resource_id:
            fail(f"{label}: missing id")
        if resource_id in ids:
            fail(f"{label}: duplicate id {resource_id}")
        ids.add(resource_id)
        if public_path in paths:
            fail(f"{label}: duplicate path {public_path}")
        paths.add(public_path)
        target = resolve(root, public_path, label)
        counts[kind] += 1

        if kind not in KINDS:
            fail(f"{label}: unsupported type {kind}")
        if item.get("scope") != "shared-skill":
            level = item.get("level")
            if level not in TRACKS:
                fail(f"{label}: invalid level {level}")
            tracks = item.get("tracks")
            if not isinstance(tracks, list) or not tracks or not set(tracks).issubset(TRACKS[level]):
                fail(f"{label}: invalid tracks for {level}")
            if item.get("language") not in {"arabe", "francais"}:
                fail(f"{label}: invalid language")
        if item.get("sha256"):
            actual = hashlib.sha256(target.read_bytes()).hexdigest()
            if actual != item["sha256"]:
                fail(f"{label}: content hash mismatch for {public_path}")
        if item.get("quiz_path"):
            resolve(root, item["quiz_path"], label + ".quiz_path")
        if item.get("correction_path"):
            resolve(root, item["correction_path"], label + ".correction_path")

    print("Student catalog valid:", len(resources), "resources;", ", ".join(f"{kind}={counts[kind]}" for kind in sorted(counts)))

if __name__ == "__main__":
    main()
