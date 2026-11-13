-- Follow-up hardening for installations that already applied the initial
-- student-submission restriction migration. A new versioned migration ensures
-- these column-level revocations are not skipped by migration history.
revoke insert (id, score, feedback, submitted_at, reviewed_at)
on public.teacher_assignment_submissions
from authenticated;
