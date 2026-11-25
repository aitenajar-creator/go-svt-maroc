# مطابقة سجل Supabase Migrations – 25 نوفمبر 2026

هذا التقرير نتيجة قراءات مباشرة من سجل migrations وكتالوج PostgreSQL في المشروعين. لم تُنفذ أي أوامر DDL أو تغييرات على الإنتاج.

## 1. مقارنة Git مع سجل Supabase

| المشروع | ملفات Git في manifest | سجلات Supabase | تطابق الإصدار والاسم | أسماء مشتركة بإصدارات مختلفة | Git فقط | DB فقط |
|---|---:|---:|---:|---:|---:|---:|
| الرئيسي | 50 | 40 | 0 | 30 | 20 | 9 |
| مجتمع الأساتذة | 7 | 6 | 0 | 5 | 2 | 1 |

**التفسير:** عدم تطابق الإصدار لا يثبت أن SQL لم يُنفذ؛ قد يكون الاسم نفسه نُفذ تحت رقم إصدار آخر. كما أن وجود ملف في Git وحده لا يثبت غياب أثره عن المخطط. لذلك لا يجوز استخدام هذه المقارنة لتشغيل `migration repair` أو `db push`.

## 2. أسماء Git-only في المشروع الرئيسي

- `student_quiz_attempts`, `teacher_classroom`, `teacher_student_private_notes`, `teacher_student_note_categories`, `teacher_student_support_plans`, `teacher_student_quiz_trend`, `student_question_followup`, `teacher_question_pins`.
- `private_site_admin_content`, `admin_student_registry`, `editable_founder_profile`, `prevent_duplicate_admin_uploads`.
- `restrict_anonymous_default_privileges`, `revoke_excess_authenticated_table_privileges`.
- `student_learning_state`, `student_lesson_objectives`.
- migrations الجديدة بتاريخ 25 نوفمبر: `student_collection_deletions`, `per_lesson_objectives`, `atomic_teacher_question_replies`, `recreate_student_collection_items`.

## 3. أسماء DB-only في المشروع الرئيسي

- `restrict_postgres_default_anon_privileges`.
- `student_learning_state_owner_scoped_sync`.
- `create_private_student_lessons`, `private_lesson_image_assets`, `limit_student_lesson_assets_to_published_courses`, `student_lesson_objectives_progress`.
- `student_lab_reviews`, `harden_lab_review_updates`, `limit_lab_review_update_columns`.

## 4. مجتمع الأساتذة

- Git-only: `teacher_community_library`, `teacher_community_storage_read_hardening`.
- DB-only: `guard_teacher_resource_moderation_fields`.
- خمسة أسماء مشتركة لها أرقام إصدار مختلفة بين الملفات والسجل.

## 5. تحقق كتالوج مباشر من migrations الأربع الجديدة

تم فحص الكتالوج دون قراءة بيانات الصفوف. لم تظهر أي من البنى التالية في المشروع الرئيسي:

| Migration | البنية المتوقعة | نتيجة الإنتاج |
|---|---|---|
| `20261125000100_student_collection_deletions.sql` | جدول `student_collection_tombstones`، والدالتان `gosvt_guard_student_collection_item()` و`gosvt_delete_student_collection_item(...)` | غير موجودة |
| `20261125000200_per_lesson_objectives.sql` | جدول `student_lesson_objectives` | غير موجود |
| `20261125000300_atomic_teacher_question_replies.sql` | العمود `teacher_question_messages.client_message_id` والدالة `gosvt_send_teacher_reply(...)` | غير موجودين |
| `20261125000400_recreate_student_collection_items.sql` | الدالة `gosvt_upsert_student_collection_item(...)` | غير موجودة |

هذه نتيجة قوية على أن migrations الأربع لم تُطبّق على قاعدة الإنتاج التي فُحصت. وهي مترابطة: migration الرابعة تعتمد على جدول tombstones الذي تنشئه الأولى. وmigration أهداف الدرس تعتمد على جدول `private_student_lessons` الموجود أصلًا في الإنتاج.

## 6. مخاطر وتوصيات

- لا تشغّل هذه migrations على الإنتاج الآن. يلزم أولًا مراجعة توافقها مع كود العميل واختبارها على نسخة قاعدة معزولة.
- انتبه خصوصًا إلى منطق tombstones: يجعل حذف مفتاح العنصر دائمًا، ويمنع إعادة استخدام المفتاح نفسه. يجب التأكد من أن العميل ينشئ معرفًا جديدًا لكل ملاحظة أو عنصر خطة جديد.
- لا تستخدم `db push`, `migration repair` أو إعادة تطبيق ملفات manifest على الإنتاج لمعالجة فروق السجل.
- يلزم schema-only baseline موثوق ومراجعة تاريخية لكل كائن قبل اعتماد أي خطة مزامنة.

## 7. حدود الفحص

الاستعلامات كانت قراءات كتالوج فقط؛ لم تُقرأ بيانات الطلاب أو الرسائل أو محتوى الدروس. غياب عنصر من الكتالوج يثبت غيابه حاليًا في المخطط المفحوص، لكنه لا يفسر وحده سبب غيابه أو ما إذا كان هناك تنفيذ بديل. هذا التقرير لا يمثل تصدير SQL كاملًا ولا تصريحًا بالنشر.
