#!/usr/bin/env python3
"""Static guard: every public table created by a migration must enable RLS
and either define an explicit policy or revoke direct client access."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
CREATE = re.compile(
    r"create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
failures = []
checked = 0

for migration in sorted(MIGRATIONS.glob("*.sql")):
    sql = migration.read_text(encoding="utf-8")
    for match in CREATE.finditer(sql):
        table = match.group(1)
        checked += 1
        table_ref = rf"public\\.{re.escape(table)}\\b"
        has_rls = re.search(
            rf"alter\\s+table\\s+{table_ref}\\s+enable\\s+row\\s+level\\s+security",
            sql,
            re.IGNORECASE,
        )
        has_policy = re.search(
            rf"create\\s+policy\\s+[\\s\\S]*?\\bon\\s+{table_ref}",
            sql,
            re.IGNORECASE,
        )
        explicitly_revoked = re.search(
            rf"revoke\\s+all\\s+on\\s+{table_ref}\\s+from\\s+anon\\s*,\\s*authenticated",
            sql,
            re.IGNORECASE,
        )
        if not has_rls:
            failures.append(f"{migration.relative_to(ROOT)}: {table} does not enable RLS")
        if not (has_policy or explicitly_revoked):
            failures.append(
                f"{migration.relative_to(ROOT)}: {table} has no policy and no explicit client-access revoke"
            )

if failures:
    print("RLS migration coverage check failed:")
    print("\\n".join(f"- {item}" for item in failures))
    sys.exit(1)

print(f"RLS migration coverage check passed for {checked} public tables.")
