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

    # Legacy column-level grants need a separately versioned follow-up migration:
    # editing an already-applied migration file would not re-run on deployed projects.
    column_revoke_migration = MIGRATIONS / "20261113000200_revoke_legacy_submission_column_grants.sql"
    if not column_revoke_migration.is_file():
        failures.append("Missing separately versioned submission column-grant revocation migration")
    else:
        column_sql = column_revoke_migration.read_text(encoding="utf-8").lower()
        if not re.search(
            r"revoke\s+insert\s*\(\s*id\s*,\s*score\s*,\s*feedback\s*,\s*submitted_at\s*,\s*reviewed_at\s*\)\s+on\s+public\.teacher_assignment_submissions\s+from\s+authenticated",
            column_sql,
        ):
            failures.append("Student submissions: follow-up migration must revoke legacy sensitive column INSERT grants")


# Classroom authorization helpers are SECURITY DEFINER and must not be callable
# by PUBLIC/anon; authenticated RLS policies and RPCs retain explicit access.
helper_migration = MIGRATIONS / "20261113000300_restrict_class_helper_function_execution.sql"
if not helper_migration.is_file():
    failures.append("Missing classroom helper-function execution restriction migration")
else:
    helper_sql = helper_migration.read_text(encoding="utf-8").lower()
    helper_signatures = (
        "gosvt_is_teacher_or_admin()",
        "gosvt_is_admin()",
        "gosvt_can_manage_class(uuid)",
        "gosvt_can_access_class(uuid)",
    )
    for signature in helper_signatures:
        escaped = re.escape(signature)
        if not re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.{escaped}\s+from\s+public\s*,\s*anon",
            helper_sql,
        ):
            failures.append(f"Classroom helper {signature}: PUBLIC and anon execution must be revoked")
        if not re.search(
            rf"grant\s+execute\s+on\s+function\s+public\.{escaped}\s+to\s+authenticated",
            helper_sql,
        ):
            failures.append(f"Classroom helper {signature}: authenticated execution must remain granted")


# Classroom UPDATE access is limited to the fields actually edited by the UI.
update_migration = MIGRATIONS / "20261113000400_restrict_teacher_update_columns.sql"
if not update_migration.is_file():
    failures.append("Missing classroom least-privilege UPDATE migration")
else:
    update_sql = update_migration.read_text(encoding="utf-8").lower()
    required_statements = (
        r"revoke\s+update\s+on\s+public\.teacher_questions\s+from\s+authenticated",
        r"revoke\s+update\s*\(\s*id\s*,\s*class_id\s*,\s*student_id\s*,\s*subject\s*,\s*body\s*,\s*created_at\s*\)\s+on\s+public\.teacher_questions\s+from\s+authenticated",
        r"grant\s+update\s*\(\s*status\s*,\s*updated_at\s*\)\s+on\s+public\.teacher_questions\s+to\s+authenticated",
        r"revoke\s+update\s+on\s+public\.teacher_assignment_submissions\s+from\s+authenticated",
        r"revoke\s+update\s*\(\s*id\s*,\s*assignment_id\s*,\s*student_id\s*,\s*answer\s*,\s*submitted_at\s*\)\s+on\s+public\.teacher_assignment_submissions\s+from\s+authenticated",
        r"grant\s+update\s*\(\s*score\s*,\s*feedback\s*,\s*reviewed_at\s*\)\s+on\s+public\.teacher_assignment_submissions\s+to\s+authenticated",
    )
    for statement in required_statements:
        if not re.search(statement, update_sql):
            failures.append("Classroom least-privilege UPDATE migration is missing a required column restriction or grant")
            break


# Support plans are read/created by the current UI; unused mutation rights stay revoked.
support_migration = MIGRATIONS / "20261113000500_limit_support_plan_permissions.sql"
if not support_migration.is_file():
    failures.append("Missing support-plan least-privilege migration")
else:
    support_sql = support_migration.read_text(encoding="utf-8").lower()
    support_patterns = (
        r"drop\s+policy\s+if\s+exists\s+teacher_support_plans_update\s+on\s+public\.teacher_student_support_plans",
        r"drop\s+policy\s+if\s+exists\s+teacher_support_plans_delete\s+on\s+public\.teacher_student_support_plans",
        r"revoke\s+update\s+on\s+public\.teacher_student_support_plans\s+from\s+authenticated",
        r"revoke\s+update\s*\([\s\w,]+\)\s+on\s+public\.teacher_student_support_plans\s+from\s+authenticated",
        r"revoke\s+delete\s+on\s+public\.teacher_student_support_plans\s+from\s+authenticated",
        r"grant\s+select\s*,\s*insert\s+on\s+public\.teacher_student_support_plans\s+to\s+authenticated",
    )
    for pattern in support_patterns:
        if not re.search(pattern, support_sql):
            failures.append("Support-plan access must be limited to SELECT and INSERT")
            break


# Private pedagogical notes: teachers may edit only content/category, never ownership.
notes_migration = MIGRATIONS / "20261113000600_restrict_teacher_note_update_columns.sql"
if not notes_migration.is_file():
    failures.append("Missing private teacher-note column restriction migration")
else:
    notes_sql = notes_migration.read_text(encoding="utf-8").lower()
    note_patterns = (
        r"revoke\s+update\s+on\s+public\.teacher_student_notes\s+from\s+authenticated",
        r"revoke\s+update\s*\(\s*id\s*,\s*class_id\s*,\s*student_id\s*,\s*teacher_id\s*,\s*note\s*,\s*note_type\s*,\s*created_at\s*,\s*updated_at\s*\)\s+on\s+public\.teacher_student_notes\s+from\s+authenticated",
        r"grant\s+update\s*\(\s*note\s*,\s*note_type\s*\)\s+on\s+public\.teacher_student_notes\s+to\s+authenticated",
    )
    for pattern in note_patterns:
        if not re.search(pattern, notes_sql):
            failures.append("Private teacher-note updates must be limited to note and note_type")
            break



# Duplicate-upload trigger helper is internal-only; the trigger remains functional.
duplicate_trigger_migration = MIGRATIONS / "20261113000700_restrict_duplicate_upload_trigger_execution.sql"
if not duplicate_trigger_migration.is_file():
    failures.append("Missing duplicate-upload trigger execution restriction migration")
else:
    duplicate_trigger_sql = duplicate_trigger_migration.read_text(encoding="utf-8").lower()
    for grantee in ("public", "anon", "authenticated"):
        if not re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.prevent_duplicate_site_content_upload\(\)\s+from\s+{grantee}",
            duplicate_trigger_sql,
        ):
            failures.append(f"Duplicate-upload trigger function: EXECUTE must be revoked from {grantee}")
            break


if failures:
    print("RLS migration coverage check failed:")
    print("\n".join(f"- {item}" for item in failures))
    sys.exit(1)

print(f"RLS migration coverage check passed for {checked} public tables and student grading-column restrictions.")
