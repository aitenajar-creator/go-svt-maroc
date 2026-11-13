#!/usr/bin/env python3
"""Audit exact duplicate PDF files without changing or deleting anything.

Usage:
    python3 _tools/audit_pdf_duplicates.py
    python3 _tools/audit_pdf_duplicates.py --json
"""
import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIRS = ("cours", "exercices", "fiches", "resumes", "examens")


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_rank(path):
    """Prefer the curated exam archive, then clean names and shorter paths."""
    parts = path.relative_to(ROOT).parts
    top = parts[0].lower() if parts else ""
    in_exam_archive = 0 if top == "examens" else 1
    numbered_copy = 1 if re.search(r"\(\d+\)(?=\.[^.]+$)", path.name) else 0
    return (in_exam_archive, numbered_copy, len(parts), "/".join(parts).casefold())


def collect_pdfs():
    by_digest = defaultdict(list)
    scanned = 0
    for folder in CONTENT_DIRS:
        base = ROOT / folder
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix.lower() != ".pdf":
                continue
            scanned += 1
            by_digest[sha256_file(path)].append(path)
    duplicates = []
    for digest, paths in by_digest.items():
        if len(paths) < 2:
            continue
        ordered = sorted(paths, key=canonical_rank)
        duplicates.append({
            "sha256": digest,
            "size_bytes": ordered[0].stat().st_size,
            "suggested_primary": ordered[0].relative_to(ROOT).as_posix(),
            "copies": [p.relative_to(ROOT).as_posix() for p in ordered],
        })
    duplicates.sort(key=lambda item: item["suggested_primary"].casefold())
    return scanned, duplicates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args()
    scanned, duplicates = collect_pdfs()
    if args.json:
        print(json.dumps({
            "scanned_pdf_files": scanned,
            "duplicate_groups": len(duplicates),
            "duplicate_extra_copies": sum(len(group["copies"]) - 1 for group in duplicates),
            "groups": duplicates,
        }, ensure_ascii=False, indent=2))
    else:
        print("PDF duplicate audit (read-only; no files are modified)")
        print(f"PDF files scanned: {scanned}")
        print(f"Exact duplicate groups: {len(duplicates)}")
        print(f"Additional identical copies: {sum(len(g['copies']) - 1 for g in duplicates)}")
        for number, group in enumerate(duplicates, 1):
            print(f"\n[{number}] SHA-256 {group['sha256']} ({group['size_bytes']} bytes)")
            print(f"  Suggested primary: {group['suggested_primary']}")
            for copy in group["copies"]:
                marker = "PRIMARY" if copy == group["suggested_primary"] else "copy"
                print(f"  - {marker}: {copy}")
        if not duplicates:
            print("No exact duplicate PDF files found.")


if __name__ == "__main__":
    main()
