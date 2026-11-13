#!/usr/bin/env python3
"""Static guard: every public table created by a migration must enable RLS
and either define an explicit policy or revoke direct client access."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
CREATE = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
failures = []
checked = 0

for migration in sorted(MIGRATIONS.glob("*.sql")):
    sql = migration.read_text(encoding="utf-8")
    for match in CREATE.finditer(sql):
        table = match.group(1)
        checked += 1
        table_ref = rf"public\.{re.escape(table)}\b"
        has_rls = re.search(
            rf"alter\s+table\s+{table_ref}\s+enable\s+row\s+level\s+security",
            sql,
            re.IGNORECASE,
        )
        has_policy = re.search(
            rf"create\s+policy\s+[\s\S]*?\bon\s+{table_ref}",
            sql,
            re.IGNORECASE,
        )
        explicitly_revoked = re.search(
            rf"revoke\s+all\s+on\s+{table_ref}\s+from\s+anon\s*,\s*authenticated",
            sql,
            re.IGNORECASE,
        )
        if not has_rls:
            failures.append(f"{migration.relative_to(ROOT)}: {table} does not enable RLS")
        if not (has_policy or explicitly_revoked):
            failures.append(
                f"{migration.relative_to(ROOT)}: {table} has no policy and no explicit client-access revoke"
            )

# Student submissions must never be able to set teacher-owned grading fields.
grading_migration = MIGRATIONS / "20261113000100_restrict_student_submission_fields.sql"
if not grading_migration.is_file():
    failures.append("Missing student submission grading-permissions migration")
else:
    grading_sql = grading_migration.read_text(encoding="utf-8").lower()
    if not re.search(
        r"revoke\s+insert\s+on\s+public\.teacher_assignment_submissions\s+from\s+authenticated",
        grading_sql,
    ):
        failures.append("Student submissions: table-level INSERT must be revoked")
    if not re.search(
        r"grant\s+insert\s*\(\s*assignment_id\s*,\s*student_id\s*,\s*answer\s*\)\s+on\s+public\.teacher_assignment_submissions\s+to\s+authenticated",
        grading_sql,
    ):
        failures.append("Student submissions: INSERT must be limited to assignment_id, student_id and answer")

    if not re.search(
        r"revoke\\s+insert\\s*\\(\\s*id\\s*,\\s*score\\s*,\\s*feedback\\s*,\\s*submitted_at\\s*,\\s*reviewed_at\\s*\\)\\s+on\\s+public\\.teacher_assignment_submissions\\s+from\\s+authenticated",
        grading_sql,
    ):
        failures.append("Student submissions: sensitive/teacher-owned column INSERT grants must be revoked")

if failures:
    print("RLS migration coverage check failed:")
    print("\n".join(f"- {item}" for item in failures))
    sys.exit(1)

print(f"RLS migration coverage check passed for {checked} public tables and student grading-column restrictions.")
