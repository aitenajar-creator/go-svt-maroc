#!/usr/bin/env python3
"""Static regression guard for the separate teacher-community Supabase project."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "supabase/migrations/20261111000100_teacher_community_library.sql"
HARDEN = ROOT / "supabase/migrations/20261111000200_teacher_community_storage_read_hardening.sql"

missing = []
for path in (BASE, HARDEN):
    if not path.is_file():
        missing.append(f"Missing expected migration: {path.relative_to(ROOT)}")

if not missing:
    base = BASE.read_text(encoding="utf-8").lower()
    harden = HARDEN.read_text(encoding="utf-8").lower()

    required_base = {
        "member self/admin read policy": "teacher_community_member_read_self_or_admin",
        "self-registration restricted to pending": "status = 'pending'",
        "admin-only membership updates": "teacher_community_member_update_admin",
        "resource visibility policy": "teacher_community_resource_read",
        "resource insert ownership policy": "teacher_community_resource_insert",
        "resource update ownership policy": "teacher_community_resource_update_owner_or_admin",
        "resource delete ownership policy": "teacher_community_resource_delete_owner_or_admin",
        "storage upload ownership policy": "teacher_community_storage_upload_own",
        "storage delete ownership policy": "teacher_community_storage_delete_own",
        "private storage bucket": "'teacher-community',\n  'teacher-community',\n  false",
        "approved-member gate": "gosvt_teacher_community_is_approved_member",
    }
    for label, needle in required_base.items():
        if needle not in base:
            missing.append(f"Base migration is missing: {label}")

    required_hardening = {
        "storage reads joined to resource metadata": "r.storage_path = storage.objects.name",
        "owner access": "r.owner_id = (select auth.uid())",
        "admin access": "gosvt_teacher_community_is_admin()",
        "shared published resource gate": "r.is_shared = true",
        "approved membership gate": "gosvt_teacher_community_is_approved_member()",
        "bucket forced private": "set public = false",
    }
    for label, needle in required_hardening.items():
        if needle not in harden:
            missing.append(f"Storage hardening migration is missing: {label}")

if missing:
    print("Teacher-community security regression check failed:")
    print("\n".join(f"- {item}" for item in missing))
    sys.exit(1)

print("Teacher-community security regression check passed.")
