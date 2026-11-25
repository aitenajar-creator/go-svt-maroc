# تدقيق مطابقة ترحيلات Supabase — 25 نوفمبر 2026

## نطاق التدقيق

هذا تقرير قراءة فقط لفرع `review/design-upgrade-v2-integration`، ويقارن ملف `supabase/project-manifest.json` بسجل الترحيلات الفعلي في مشروعي Supabase. لم تُنفّذ أي تغييرات على قواعد البيانات، ولم تُقرأ بيانات التلاميذ أو محتوياتهم.

المشروعات:
- الرئيسي: `faztvkeyrxvmjzzfuyiu`
- مجتمع الأساتذة: `gymofjissiuwpnaxsmcw`

## النتائج

### المشروع الرئيسي

- الترحيلات المدرجة في manifest: **50**.
- سجلات الترحيل في قاعدة الإنتاج: **40**.
- توجد **30** تسمية مشتركة بين Git وسجل الإنتاج، لكن إصدارات timestamp مختلفة في الحالات الثلاثين.
- توجد **20** تسمية في Git لا يقابلها سجل بالاسم نفسه في قاعدة الإنتاج.
- توجد **9** تسميات في سجل الإنتاج لا يقابلها ملف/اسم في manifest.
- سجل الإنتاج يحتوي على نسختين مختلفتين بالاسم نفسه `restrict_duplicate_upload_trigger_execution`، بينما manifest يسرد ملفًا واحدًا بهذا الاسم.

الأسماء الموجودة في Git ولا يقابلها اسم في سجل الإنتاج:
- `student_quiz_attempts`
- `teacher_classroom`
- `teacher_student_private_notes`
- `teacher_student_note_categories`
- `teacher_student_support_plans`
- `teacher_student_quiz_trend`
- `student_question_followup`
- `teacher_question_pins`
- `private_site_admin_content`
- `admin_student_registry`
- `editable_founder_profile`
- `prevent_duplicate_admin_uploads`
- `restrict_anonymous_default_privileges`
- `revoke_excess_authenticated_table_privileges`
- `student_learning_state`
- `student_lesson_objectives`
- `student_collection_deletions`
- `per_lesson_objectives`
- `atomic_teacher_question_replies`
- `recreate_student_collection_items`

الأسماء الموجودة في سجل الإنتاج ولا يقابلها اسم في manifest:
- `restrict_postgres_default_anon_privileges`
- `student_learning_state_owner_scoped_sync`
- `create_private_student_lessons`
- `private_lesson_image_assets`
- `limit_student_lesson_assets_to_published_courses`
- `student_lesson_objectives_progress`
- `student_lab_reviews`
- `harden_lab_review_updates`
- `limit_lab_review_update_columns`

### مجتمع الأساتذة

- الترحيلات في manifest: **7**.
- سجلات الإنتاج: **6**.
- توجد **5** تسميات مشتركة، وإصدارات timestamp مختلفة في الحالات الخمس.
- ملفان في Git لا يقابلهما سجل بالاسم نفسه: `teacher_community_library` و`teacher_community_storage_read_hardening`.
- يوجد سجل إنتاج إضافي لا يقابله ملف في manifest: `guard_teacher_resource_moderation_fields`.

> اختلاف timestamp وحده لا يثبت أن SQL لم يُنفّذ؛ وقد تكون بعض الترحيلات أُعيدت تسميتها أو جُمعت أو نُفّذت في وقت مختلف. وبالمثل، غياب الاسم لا يثبت غياب البنية الوظيفية. يلزم فحص SQL الفعلي والجداول والدوال والسياسات قبل أي استنتاج تنفيذي.

## فحص RLS للجداول التي أبلغ عنها المستشار

الجداول التالية في المشروع الرئيسي عليها RLS، ولا تملك سياسات RLS، ولا تمنح صلاحيات الجدول لـ `anon` أو `authenticated`؛ الصلاحيات المرصودة كانت لـ `service_role` فقط:
- `public.answer_keys`
- `public.security_audit_log`
- `public.teacher_class_join_attempts`

وفي مشروع مجتمع الأساتذة:
- `public.teacher_community_admins` عليها RLS ولا توجد سياسات، وصلاحيات الجدول المرصودة لـ `service_role` فقط.

هذا النمط مغلق افتراضيًا، ولا ينبغي إضافة سياسات عامة إليه لمجرد إسكات تنبيه المستشار. يجب الحفاظ على الوصول عبر المسارات الموثوقة المقصودة، ثم اختبار كل مسار.

## ملاحظات SECURITY DEFINER

أظهر مستشار الأمان 19 دالة `SECURITY DEFINER` قابلة للاستدعاء من `authenticated` في المشروع الرئيسي، ودالتين في مجتمع الأساتذة. مراجعة التعريفات المتاحة أظهرت أن كثيرًا منها helpers أو RPCs تتحقق من هوية المستخدم أو دوره أو ملكيته/علاقته بالفصل قبل إرجاع بيانات أو تنفيذ تعديل. كما أن `anon` لا يملك صلاحية تنفيذ هذه الدوال في نتائج فحص الصلاحيات.

لذلك لا يُنصح بسحب صلاحية `EXECUTE` جماعيًا؛ فقد يعطّل تسجيل التلاميذ في الفصول، واسترجاع قوائم الفصول، والتصحيح، وحفظ الإجابات، وإدارة الموارد. يلزم اختبار كل دالة من حساب طالب/أستاذ/مدير وحساب غير مصرح به قبل أي تعديل.

## قرار السلامة

**لا تشغّل حاليًا** أيًا من الآتي على مشروعات الإنتاج:
- `supabase db push`
- `supabase migration repair`
- `supabase db reset --linked`
- إعادة تطبيق ملفات manifest المفقودة بالاسم أو timestamp.

السبب: سجل الترحيلات لا يطابق manifest، وهناك سجلات إنتاج لا يملك Git مصدرًا مطابقًا لها. تنفيذ أو إصلاح السجل الآن قد يؤدي إلى إعادة تنفيذ تغييرات قائمة أو ترك تغييرات فعلية دون تمثيل صحيح في المستودع.

## المسار الآمن التالي

1. حفظ نسخة مخطط فقط من كل مشروع، دون صفوف بيانات المستخدمين، ودون مفاتيح أو أسرار.
2. استرجاع/توثيق SQL الخاص بالسجلات الموجودة في الإنتاج وغير الموجودة في Git، خصوصًا `guard_teacher_resource_moderation_fields` وترحيلات الدروس الخاصة ومختبر التقييم.
3. مطابقة كل ترحيل بالنتيجة الفعلية في الجداول، الأعمدة، القيود، الدوال، triggers، سياسات RLS، وصلاحيات Storage.
4. بناء baseline مستقل لكل مشروع محليًا، ثم اختبار `supabase db reset` محليًا فقط.
5. عدم تعديل migration history أو نشر أي migration قبل مراجعة dry-run وموافقة صريحة.

## مصادر الإجراء

- [Supabase: Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase: Repair the migration history table](https://supabase.com/docs/reference/cli/supabase-migration-repair)

هذا التقرير توثيق للتدقيق فقط، ولا يغيّر أي إعداد أو بيانات في Supabase.
