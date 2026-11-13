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



# Owner-managed public resources use a retryable hide-first deletion flow.
resource_delete_migration = MIGRATIONS / "20261113000800_safe_admin_resource_deletion.sql"
if not resource_delete_migration.is_file():
    failures.append("Missing safe admin-resource deletion migration")
else:
    resource_delete_sql = resource_delete_migration.read_text(encoding="utf-8").lower()
    resource_delete_patterns = (
        r"add\s+column\s+if\s+not\s+exists\s+is_deleted\s+boolean\s+not\s+null\s+default\s+false",
        r"create\s+policy\s+site_content_public_read[\s\S]*?using\s*\(\s*is_deleted\s*=\s*false\s*\)",
        r"create\s+policy\s+site_content_admin_read[\s\S]*?using\s*\(\s*public\.gosvt_is_site_admin\(\)\s*\)",
    )
    for pattern in resource_delete_patterns:
        if not re.search(pattern, resource_delete_sql):
            failures.append("Safe resource deletion must preserve a hidden retryable record and restrict public reads")
            break


# Legacy SECURITY DEFINER RPCs must not be callable by anonymous users.
# Internal trigger helpers are revoked from all client roles; user-facing RPCs
# remain explicitly executable by authenticated users only.
legacy_rpc_migration = MIGRATIONS / "20261113000900_restrict_legacy_security_definer_rpcs.sql"
if not legacy_rpc_migration.is_file():
    failures.append("Missing legacy SECURITY DEFINER RPC restriction migration")
else:
    legacy_rpc_sql = legacy_rpc_migration.read_text(encoding="utf-8").lower()
    internal_functions = ('"current_role"()', 'handle_new_user()')
    for signature in internal_functions:
        if not re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.{re.escape(signature)}\s+from\s+public\s*,\s*anon\s*,\s*authenticated",
            legacy_rpc_sql,
        ):
            failures.append(f"Internal SECURITY DEFINER function {signature}: client EXECUTE must be revoked")
    authenticated_functions = (
        "gosvt_is_site_admin()",
        "gosvt_join_teacher_class(text)",
        "gosvt_student_classes()",
        "gosvt_student_reopen_question(uuid)",
        "gosvt_teacher_class_roster(uuid)",
        "grade_submission(uuid, numeric, numeric)",
        "is_admin()",
        "is_student_in_class(uuid)",
        "save_answer(uuid, uuid, jsonb)",
        "start_attempt(uuid)",
        "submit_submission(uuid)",
        "teaches_class(uuid)",
    )
    for signature in authenticated_functions:
        escaped = re.escape(signature)
        if not re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.{escaped}\s+from\s+public\s*,\s*anon",
            legacy_rpc_sql,
        ):
            failures.append(f"Legacy SECURITY DEFINER RPC {signature}: PUBLIC/anon EXECUTE must be revoked")
        if not re.search(
            rf"grant\s+execute\s+on\s+function\s+public\.{escaped}\s+to\s+authenticated",
            legacy_rpc_sql,
        ):
            failures.append(f"Legacy SECURITY DEFINER RPC {signature}: authenticated EXECUTE must remain granted")


# Role-change guard is trigger-only and must not be directly callable by API roles.
role_trigger_migration = MIGRATIONS / "20261113001000_restrict_profile_role_trigger_execution.sql"
if not role_trigger_migration.is_file():
    failures.append("Missing profile role-trigger EXECUTE restriction migration")
else:
    role_trigger_sql = role_trigger_migration.read_text(encoding="utf-8").lower()
    for grantee in ("public", "anon", "authenticated"):
        if not re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.prevent_profile_role_change\(\)\s+from\s+{grantee}",
            role_trigger_sql,
        ):
            failures.append(f"Profile role-change trigger function: EXECUTE must be revoked from {grantee}")
            break

# Community membership/admin helpers are RLS predicates, not anonymous RPCs.
community_helper_migration = MIGRATIONS / "20261113001100_restrict_teacher_community_helper_execution.sql"
if not community_helper_migration.is_file():
    failures.append("Missing teacher-community helper EXECUTE restriction migration")
else:
    community_helper_sql = community_helper_migration.read_text(encoding="utf-8").lower()
    for signature in (
        "gosvt_teacher_community_is_admin()",
        "gosvt_teacher_community_is_approved_member()",
    ):
        escaped = re.escape(signature)
        if not re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.{escaped}\s+from\s+public",
            community_helper_sql,
        ) or not re.search(
            rf"revoke\s+all\s+on\s+function\s+public\.{escaped}\s+from\s+anon",
            community_helper_sql,
        ):
            failures.append(f"Teacher-community helper {signature}: PUBLIC/anon EXECUTE must be revoked")
        if not re.search(
            rf"grant\s+execute\s+on\s+function\s+public\.{escaped}\s+to\s+authenticated",
            community_helper_sql,
        ):
            failures.append(f"Teacher-community helper {signature}: authenticated EXECUTE must remain granted")


# Anonymous clients may read only deliberately public site metadata tables.
anon_grants_migration = MIGRATIONS / "20261113001200_minimize_anonymous_table_grants.sql"
if not anon_grants_migration.is_file():
    failures.append("Missing anonymous table-grants minimization migration")
else:
    anon_grants_sql = anon_grants_migration.read_text(encoding="utf-8").lower()
    if not re.search(r"revoke\\s+all\\s+privileges\\s+on\\s+all\\s+tables\\s+in\\s+schema\\s+public\\s+from\\s+anon", anon_grants_sql):
        failures.append("Anonymous table grants: broad legacy privileges must be revoked")
    for table in ("site_content_items", "site_founder_profile"):
        if not re.search(
            rf"grant\\s+select\\s+on\\s+table\\s+public\\.{table}\\s+to\\s+anon",
            anon_grants_sql,
        ):
            failures.append(f"Anonymous table grants: public SELECT must remain on {table}")


sequence_grants_migration = MIGRATIONS / "20261113001300_revoke_anonymous_sequence_grants.sql"
if not sequence_grants_migration.is_file():
    failures.append("Missing anonymous sequence-grants restriction migration")
else:
    sequence_grants_sql = sequence_grants_migration.read_text(encoding="utf-8").lower()
    if not re.search(
        r"revoke\\s+all\\s+privileges\\s+on\\s+all\\s+sequences\\s+in\\s+schema\\s+public\\s+from\\s+anon",
        sequence_grants_sql,
    ):
        failures.append("Anonymous sequence grants: all legacy sequence privileges must be revoked")


default_grants_migration = MIGRATIONS / "20261113001400_restrict_anonymous_default_privileges.sql"
if not default_grants_migration.is_file():
    failures.append("Missing postgres default anonymous-privilege restriction migration")
else:
    default_grants_sql = default_grants_migration.read_text(encoding="utf-8").lower()
    for object_type in ("tables", "sequences"):
        if not re.search(
            rf"alter\\s+default\\s+privileges\\s+for\\s+role\\s+postgres\\s+in\\s+schema\\s+public\\s+revoke\\s+all\\s+on\\s+{object_type}\\s+from\\s+anon",
            default_grants_sql,
        ):
            failures.append(f"Postgres default privileges: anonymous access to future {object_type} must be revoked")


if failures:
    print("RLS migration coverage check failed:")
    print("\n".join(f"- {item}" for item in failures))
    sys.exit(1)

print(f"RLS migration coverage check passed for {checked} public tables and student grading-column restrictions.")
