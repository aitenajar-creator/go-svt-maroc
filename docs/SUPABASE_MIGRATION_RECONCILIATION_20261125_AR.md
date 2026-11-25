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


## 7. توافق كود الواجهة مع البنى الغائبة – بوابة نشر إلزامية

تمت مراجعة استدعاءات الواجهة في commit الحالي:

- `supabase-config.js` يستدعي `gosvt_upsert_student_collection_item` و`gosvt_delete_student_collection_item` لمزامنة الملاحظات وخطة الدراسة وحذف عناصرهما.
- `teacher-classroom.js` يستدعي `gosvt_send_teacher_reply` لإرسال ردود الأستاذ/التلميذ داخل المحادثات.
- `lesson-reader.js` يقرأ ويكتب مباشرة في `student_lesson_objectives`، كما تعرض `private-student-lessons.js` تقدم أهداف الدروس من الجدول نفسه.

وبما أن هذه الدوال والجدول والعمود غير موجودة في كتالوج الإنتاج الذي فُحص، فإن نشر الواجهة الجديدة وحدها قبل تطبيق migrations المطابقة سيؤدي إلى فشل مزامنة الملاحظات وخطة الدراسة والحذف، وفشل إرسال الردود، وتعطل حفظ أهداف الدروس. وقد تعرض بعض الواجهات تقدمًا فارغًا أو رسالة تعذر الحفظ.

**قرار النشر:** لا تنشر أو تدمج واجهة هذا الفرع على الإنتاج قبل تجهيز نسخة قاعدة معزولة، والتحقق من خط أساس المشروع الرئيسي، وتشغيل migrations الأربع عليها، واختبار المسارات السابقة بحسابات طالب وأستاذ. لا يعني هذا التقرير الموافقة على تطبيقها على الإنتاج.

## 8. حدود الفحص

الاستعلامات كانت قراءات كتالوج فقط؛ لم تُقرأ بيانات الطلاب أو الرسائل أو محتوى الدروس. غياب عنصر من الكتالوج يثبت غيابه حاليًا في المخطط المفحوص، لكنه لا يفسر وحده سبب غيابه أو ما إذا كان هناك تنفيذ بديل. هذا التقرير لا يمثل تصدير SQL كاملًا ولا تصريحًا بالنشر.


## 9. مطابقة أعمدة الجداول الموجودة مع SQL الجديد – قراءة كتالوج إضافية

أُعيد فحص تعريف الأعمدة والقيود في قاعدة المشروع الرئيسي بقراءات SELECT فقط، دون قراءة صفوف المستخدمين. تأكد وجود الأعمدة التي تعتمد عليها migrations الجديدة:

- `student_notes`: `student_id`, `content_key`, `note`, `updated_at`، مع قيد فريد على `(student_id, content_key)` وحد أقصى لطول `note` يساوي 10000.
- `student_study_plan`: `student_id`, `item_key`, `title`, `scheduled_date`, `duration_minutes`, `completed`, `created_at`, `updated_at`، مع قيد فريد على `(student_id, item_key)` وقيود العنوان والمدة.
- `private_student_lessons`: المفتاح `id` من نوع UUID، وعمود `is_published` موجود؛ وهذا يطابق نوع الربط وشرط النشر في migration أهداف الدروس.
- `student_learning_state.lesson_objectives` موجود ونوعه JSONB، وهو مصدر الترحيل الخلفي في migration أهداف الدروس.
- `teacher_question_messages` يحتوي `question_id`, `sender_id`, `body` وقيود طول الرسالة؛ العمود الجديد `client_message_id` غير موجود حاليًا.
- `teacher_questions` يحتوي `class_id`, `student_id`, `status`, `updated_at`، وقيم الحالة المقيدة تشمل `new` و`answered`.

**الاستنتاج المحدود:** شكل الأعمدة والقيود الأساسية التي تعتمد عليها ملفات SQL الأربع متوافق مع الكتالوج الحالي في المواضع التي أمكن التحقق منها. هذا لا يثبت أن تطبيق migrations آمن على الإنتاج؛ فما زال سجل التاريخ غير متطابق، ولا يوجد baseline كامل قابل لإعادة البناء، ولم تُختبر النسخة على staging مطابقة. لم تُجر أي كتابة على قاعدة الإنتاج.

## 10. هوية الملف الشخصي بين الأجهزة – مانع توافق إضافي اكتُشف في 26 نوفمبر

أظهر فحص `student-account.js` و`student-space.js` و`masahati.js` ما يلي:

- ينشئ `StudentSpace.createProfile()` معرّفاً عشوائياً عبر `crypto.randomUUID()` (أو بديلاً عشوائياً)، ويخزن `student-account.js` ربط `auth.uid() -> localProfileId` في `localStorage` تحت المفتاح `gosvt_supabase_profile_map`.
- هذا الربط محلي للمتصفح؛ جهاز جديد لا يملك هذا المفتاح، ولذلك قد ينشئ معرّفاً محلياً مختلفاً للحساب نفسه.
- `masahati.js` يستخدم `pid()` نفسه كقيمة `profile_id` في `student_platform_state` عند القراءة والكتابة.
- نتيجة ذلك: حتى بعد إنشاء الجدول، قد لا يستعيد الحساب نفسه حالة Masahati على جهاز آخر لأن استعلام القراءة يبحث عن `profile_id` محلي مختلف.
- اختبار `tests/masahati-sync-regression.test.cjs` الحالي يثبت العزل بين قيم profile_id مختلفة داخل harness، لكنه لا يثبت ثبات هوية الملف الشخصي للحساب بين متصفحين/جهازين مستقلين.
- كما أن `syncCurrentProfile()` في `student-space.js` يعطي الأولوية لـ `StudentAccount.activeProfileId()` عند وجود جلسة حساب؛ لذلك يجب حسم ما إذا كانت الملفات المتعددة مدعومة فعلياً داخل الحساب المسجل أم أن لكل حساب ملف تعلم واحداً.

**الإجراء المطلوب قبل اعتماد مزامنة Masahati:** اختيار هوية سحابية مستقرة ومصرح بها من الخادم، لا استخدام معرّف `localStorage` العشوائي مباشرة. إذا كان لكل حساب ملف تعلم واحد، يمكن اعتماد مفتاح ثابت مرتبط بالحساب (مع إبقاء معرّف التخزين المحلي دون تغيير). أما إذا كانت هناك ملفات تعلم متعددة للحساب الواحد، فيلزم سجل ملفات شخصي سحابي بهويات UUID ثابتة وصلاحيات RLS تربط كل ملف بمالكه، مع آلية ترحيل تربط الملفات المحلية الحالية بهوياتها الجديدة دون دمج أو استبدال البيانات تلقائياً.

**بوابة الاختبار:** إضافة اختبار بمحاكاة جهازين مستقلين للحساب نفسه، لكل منهما localStorage فارغ ومعرّف محلي مولّد مختلف؛ يجب أن يستعيد الجهاز الثاني حالة الحساب الصحيحة، مع بقاء بيانات حساب آخر معزولة. لا تطبق migration `00500` على الإنتاج قبل حسم هذا التصميم واختباره.
