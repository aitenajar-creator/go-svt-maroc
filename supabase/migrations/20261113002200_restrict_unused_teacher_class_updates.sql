-- Class management currently creates, lists and deletes classes; there is no
-- supported edit workflow. In particular, broad UPDATE would allow a class
-- manager to change teacher_id while still satisfying the row-level policy.
-- Keep ownership changes out of the client API until an explicit admin-only
-- transfer workflow with dedicated checks is implemented.
revoke update on table public.teacher_classes from authenticated;
