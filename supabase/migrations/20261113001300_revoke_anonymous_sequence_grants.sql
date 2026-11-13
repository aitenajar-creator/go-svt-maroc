-- Sequence access is separate from table privileges in PostgreSQL.
-- Anonymous clients have no reason to consume internal audit/attempt sequences.
revoke all privileges on all sequences in schema public from anon;
