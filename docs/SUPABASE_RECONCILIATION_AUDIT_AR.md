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


## تحقق إضافي من تخزين مجتمع الأساتذة

- حاوية `teacher-community` موجودة وهي **خاصة** (`public=false`) وحدّ الملف 50 MiB، مع قائمة MIME محددة.
- سياسة القراءة على `storage.objects` تسمح للمالك أو مدير المجتمع أو الأستاذ المعتمد بقراءة الملف المشترك المنشور؛ وتسمح للمالك بقراءة ملفه الخاص.
- الرفع مقيد بمجلد يبدأ بمعرف المستخدم، ويتطلب عضوية معتمدة أو صفة مدير.
- الحذف مقيد بالمالك أو مدير المجتمع.

هذه السياسات المرصودة حاليًا تبدو متسقة مع مبدأ مشاركة الموارد بين الأساتذة المعتمدين دون جعل الحاوية عامة. لذلك لا ينبغي تحويل الحاوية إلى public أو إضافة سياسة قراءة عامة. ومع ذلك يجب اختبار حالات المستخدم غير المعتمد والموقوف والمالك والمدير في البيئة المحلية قبل أي تغيير.


## مطابقة البنية الفعلية للدروس الخاصة وتقييمات المختبر

تم فحص metadata فقط في المشروع الرئيسي، دون قراءة صفوف أو محتوى الدروس:

### الدروس الخاصة وملفاتها

- جدول `public.private_student_lessons` موجود في الإنتاج، وعليه RLS.
- سياسة الإدارة `private_lessons_admin_all` تقصر الإدارة على `gosvt_is_site_admin()`.
- سياسة قراءة التلميذ تشترط أن يكون الدرس منشورًا وأن يكون دور المستخدم `student`.
- حاوية `private-lesson-assets` موجودة وخاصة، حدها 5 MiB وتقبل JPEG/PNG/WebP فقط.
- سياسات التخزين تقصر الرفع والتعديل والحذف والقراءة الإدارية على مدير الموقع، وتسمح للتلميذ بقراءة ملفات الدروس المرتبطة بدروس منشورة فقط.
- المستودع يحتوي على استدعاءات تشغيلية لهذا الجدول والحاوية في `admin.js` و`lesson-reader.js`، لكنه لا يحتوي على ملف migration مطابق ينشئ هذه البنية. كما أن وثيقة `design-upgrade-v2/files/docs/DATABASE_DEPLOYMENT_AR.md` تقر صراحة بأن هذه البنية تعتمد على إعداد سابق غير ممثل كاملًا في Git.

**النتيجة:** لا يجوز اعتبار ملف fixture الحالي مصدرًا حقيقيًا لمخطط هذه الميزة. يجب استعادة schema الأصلي أو إعداد baseline موثق قبل إعادة بناء قاعدة محلية قابلة للتكرار.

### تقييمات مختبر علوم الحياة والأرض

الإنتاج يحتوي على الجداول التالية، وكلها عليها RLS:
- `lab_reviews`: تقييم واحد لكل مستخدم ولكل مختبر، مع درجة 1–5 ونص بين 10 و1000 حرف وحالة مراجعة.
- `lab_review_helpful`: تصويت مفيد فريد لكل مستخدم/تقييم.
- `lab_review_reports`: بلاغات عن التقييمات مع حالات open/resolved/dismissed.

السياسات تقصر إنشاء التقييم على المستخدم نفسه وتبدأ الحالة بـ `pending`، وتتيح القراءة للتقييمات المنشورة أو لصاحب التقييم أو المدير. تعديل صاحب التقييم يعيد الحالة إلى pending، كما يحمي trigger حقول الهوية والعداد. إدارة البلاغات والتقييمات مقيدة بدور admin. دوال trigger المميزة موجودة في schema خاص `private`، وليس كواجهات RPC عامة.

بحث المستودع الحالي عن `lab_reviews` لم يُظهر migration أو كود واجهة/مصدرًا مطابقًا لهذه الجداول. لذلك يجب التعامل معها كميزة إنتاجية ذات مصدر SQL غير مستعاد بعد، لا كجداول يمكن حذفها أو تجاهلها.

### جلسات مراجعة الأستاذ

- جدول `teacher_review_sessions` موجود وعليه RLS.
- الإنشاء والتعديل يتطلبان صلاحية إدارة الفصل عبر `gosvt_can_manage_class(class_id)`، ويُقيد `created_by` بالمستخدم الحالي.
- القراءة مرتبطة بصلاحية الوصول إلى الفصل عبر `gosvt_can_access_class(class_id)`.
- توجد مراجع إلى `teacher_classes` و`profiles` بقيود FK.

هذا الجدول أيضًا جزء من بنية الإنتاج التي يجب تمثيلها في baseline قبل اختبار reset محلي.

## تحديث الاستنتاج

لدينا الآن دليل مباشر أن بعض الأسماء الإضافية في سجل الإنتاج ليست مجرد اختلاف أسماء ترحيلات: توجد بالفعل جداول وسياسات وحاويات مرتبطة بميزات يستخدمها كود المستودع أو موجودة في الإنتاج دون مصدر migration ظاهر في فرع PR. وبالأخص `private_student_lessons` و`private-lesson-assets` وميزات تقييم المختبر.

**المطلوب التالي ليس تنفيذ ترحيلات جديدة**؛ بل استعادة schema-only baseline مستقل للمشروع الرئيسي، والتحقق من نسخة Git التاريخية/الفرع الذي أضاف هذه الميزات، ثم إلحاقها بمصدر migrations مضبوط. لا تُحذف الجداول أو السياسات ولا تُصلح migration history اعتمادًا على الأسماء وحدها.

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
## تتبع المصدر التاريخي في Git — 25 نوفمبر 2026

تم توسيع البحث من الفرع الحالي إلى سجل commits التاريخي، مع فحص أشجار Git عند commits إنشاء الميزات:

- `630836e72feb560a233b13eed977c936dc52ce00`: أضاف واجهة وإدارة الدروس الخاصة، وقارئ الدرس، وربطًا بجدول `private_student_lessons`. لكن شجرة هذا commit لا تحتوي على migration تأسيسي لهذا الجدول أو حاوية التخزين الخاصة.
- `e2669fdfb522ff0602007f3d9bd133f3290dd0be`: أضاف رفع الصور الأصلية واستعمال signed URLs من الحاوية `private-lesson-assets`. التغيير يؤكد اعتماد الكود على الحاوية، لكنه لا يضيف migration لإنشائها أو سياساتها.
- `7a5ea9e1fc9067f58ef07a460a5ebb8944c4a1bf`: أضاف واجهة تقييمات مختبر التطور التي تتعامل مع `lab_reviews` و`lab_review_helpful` و`lab_review_reports`. شجرة Git عند هذا commit لا تتضمن migration لهذه الجداول.
- `45fa73d2a0147336b53a9f66be1ecd3e34253726`: عمّم عرض نظام التقييمات على المختبرات التفاعلية عبر `review-system.js`، لكنه لا يثبت مصدر إنشاء الجداول في قاعدة الإنتاج.
- في المقابل، `teacher_review_sessions` لها مصدر تأسيسي ظاهر في `supabase/migrations/20261110000200_teacher_classroom.sql` على `main`؛ ويعرّف الجدول وسياسات القراءة والإدارة المرتبطة بعضوية الفصل.

كما لم يُظهر بحث سجل commits عن الأسماء `create_private_student_lessons` و`private_lesson_image_assets` و`student_lab_reviews` و`harden_lab_review_updates` نتائج commits قابلة للاستعادة في المستودع.

**الاستنتاج المحدّث:** استُعيد الآن تاريخ كود الواجهات الذي يفسر وجود بعض الميزات، لكن SQL التأسيسي للدروس الخاصة وملفاتها وتقييمات المختبر لا يزال غير موجود في الأشجار التاريخية التي فُحصت. لذلك لا يجوز توليد migrations تخمينية من استدعاءات JavaScript أو من وصف السياسات وحده. يلزم schema-only export من المشروع الرئيسي أو استعادة ملفات SQL من مصدر النسخ الاحتياطي/سجل النشر المخوّل. أما `teacher_review_sessions` فيمكن ربطها بالـ migration التاريخي المذكور بعد التحقق من محتواه مقابل مخطط الإنتاج.
## تحقق CI بعد تحديث التقرير

على Commit `9047aa1f70c2df651d48cb4b951410094b945956` اكتمل GitHub Actions run `45644585806` (run number `1603`) بنتيجة `success`.

اجتازت الوظيفة الوحيدة `Source, behavior, database fixtures and browser checks` خطوات فحص ملفات المصدر وترتيب تحميل الأصول، تغطية RLS في migrations، سياسات مجتمع الأساتذة، تعيين migrations للمشروعات، اختبارات PostgreSQL المعزولة، واختبارات المتصفح باستخدام خدمات mock، ثم بناء GitHub Pages والتحقق من artifact.

**حدود هذا الدليل:** هذه الاختبارات لا تتصل بقاعدة Supabase الإنتاجية ولا تثبت مطابقة schema الإنتاجي، ولا تمثل اختبارًا مباشرًا لتسجيل الدخول أو Storage أو RLS على حسابات حقيقية. لذلك تبقى الحاجة إلى schema-only baseline واختبار محلي/بيئة معزولة قائمة. لا يُعد نجاح CI موافقة على الدمج أو النشر.

## متابعة التحقق – 25 نوفمبر 2026 (15:31 UTC)

### حالة طلب الدمج والاختبارات
- أعيد فحص PR #490: ما زال مفتوحًا وDraft، وقابلًا للدمج (mergeable=true) دون تعارض مع main.
- بعد تحديث إجراءات GitHub Actions إلى actions/checkout@v5 وactions/setup-node@v5 في .github/workflows/pages.yml و.github/workflows/validate-site.yml، نجح Run #1605 على commit 4ea3a5ebd3851c044aaefed5f6154cb8afb84cd9.
- جميع خطوات المهمة نجحت، ولم تعد سجلات التشغيل تحتوي على تحذير Node.js 20 الذي ظهر في Run #1604.
- نجاح CI لا يعادل اختبارًا حيًا لمصادقة Supabase أو سياسات RLS/Storage في الإنتاج.

### لقطة مخطط الإنتاج – استعلامات قراءة فقط
- المشروع الرئيسي: 37 جدولًا في public، وجميعها مفعّل عليها RLS. رُصد 96 فهرسًا و182 قيدًا (70 CHECK و63 FOREIGN KEY و37 PRIMARY KEY و12 UNIQUE).
- ثلاثة جداول عليها RLS دون سياسات: answer_keys وsecurity_audit_log وteacher_class_join_attempts. أظهر فحص صلاحيات الجدول أن المنح مقتصرة على postgres وservice_role، ولا توجد منح لـ anon أو authenticated. لذلك تُسجّل هذه كجداول مقفلة عمدًا، ولا تُنشأ لها سياسات عامة.
- مشروع مجتمع الأساتذة: أربعة جداول في public، جميعها مفعّل عليها RLS. جدول teacher_community_admins دون سياسة RLS، ويجب الإبقاء على نمط الوصول المقيد وعدم إضافة سياسة عامة.
- لم تُقرأ أي صفوف تخص الطلاب أو المستخدمين، ولم تُنفذ أي أوامر DDL أو تغييرات على المشروعين.

### القرار
تبقى مطابقة الـ baseline غير مكتملة حتى استعادة تعريفات SQL التأسيسية للدروس الخاصة وتقييمات المختبر وغيرها من البنى غير الممثلة في سجل Git. لا تطبق migrations على الإنتاج ولا تنفذ migration repair أو db push اعتمادًا على هذه اللقطة وحدها.

## تدقيق بنى الإنتاج الحساسة – استكمال 25 نوفمبر 2026

### التحقق من فروع Git التاريخية
- جرى توسيع البحث من main وفرع PR إلى فروع Git التاريخية ذات الصلة، ومنها feature/private-student-lessons وfeature/private-lessons-catalog-enhancements وfeature/private-lesson-source-images وfeature/private-lesson-objectives.
- لم يظهر في أشجار هذه الفروع ملف migration يؤسس public.private_student_lessons أو حاوية private-lesson-assets أو جداول lab_reviews وlab_review_helpful وlab_review_reports. الموجود من migrations في هذه الأشجار يتعلق ببنى أخرى مثل ملاحظات الأستاذ الخاصة وإدارة محتوى الموقع.
- لذلك لا يمكن اعتماد أي من هذه الفروع كمصدر SQL تأسيسي موثوق للبنى المذكورة، ولا ينبغي إعادة إنشائها تخمينًا.

### توصيف البنى الحساسة في الإنتاج (catalog فقط)
- public.private_student_lessons: الجدول موجود ومفعّل عليه RLS، وله سياسات منفصلة لإدارة مدير الموقع وقراءة الطالب للدرس المنشور فقط. فحص الأعمدة والقيود يبين أنه يحتوي محتوى HTML وبيانات المستوى والمسلك واللغة والنشر والمالك، دون استخراج محتوى الصفوف.
- public.lab_reviews وpublic.lab_review_helpful وpublic.lab_review_reports: الجداول الثلاثة موجودة ومفعّل عليها RLS. سياسات القراءة تسمح بالتقييمات المنشورة أو لصاحب التقييم أو المدير؛ إدراج التقييم يفرض هوية المستخدم وحالة pending؛ التعديل يمر عبر trigger يمنع تغيير الهوية والعداد ويعيد التقييم إلى pending. البلاغات والتصويتات مرتبطة بالمستخدم وتخضع لسياسات خاصة.
- وظائف triggers الخاصة بالتقييمات موجودة في schema private: bump_lab_review_helpful وset_lab_review_author بدور SECURITY DEFINER وبـ search_path ثابت، وguard_lab_review_update دون SECURITY DEFINER مع حماية حقول الهوية والعداد. لم تُجرَ أي تغييرات على هذه الوظائف.
- public.teacher_review_sessions له سياسات RLS تقيد القراءة بصلاحية الوصول للفصل، والإنشاء/التعديل بصلاحية إدارة الفصل وبهوية المنشئ.
- private-lesson-assets تبقى حاوية خاصة كما وثّق التدقيق السابق؛ لا تغيير في إعداداتها أو سياساتها.

### حدود العمل والقرار
- هذه النتائج توصيف للـ catalog والسياسات والـ triggers الحالية، وليست schema-only dump قابلًا لإعادة البناء تلقائيًا؛ ما زال يلزم الحصول على SQL تأسيسي موثوق أو تصدير schema-only معتمد يشمل الجداول والقيود والفهارس والدوال والـ triggers والسياسات وStorage.
- لم تُقرأ محتويات دروس خاصة أو تقييمات أو ملفات أو صفوف مستخدمين. لم ينفذ أي DDL أو migration أو تعديل على Supabase.

## جرد كتالوج التطبيق وStorage – 25 نوفمبر 2026

تم استخراج جرد من information_schema وpg_catalog للمخططات التطبيقية public/private وstorage فقط، دون قراءة صفوف الجداول أو بيانات الحسابات. لا يشمل هذا الجرد مخططات Supabase الداخلية مثل auth/realtime/extensions.

### المشروع الرئيسي
- public: 37 جدولًا، 261 عمودًا، 182 قيدًا (70 CHECK و63 FOREIGN KEY و37 PRIMARY KEY و12 UNIQUE)، 96 فهرسًا، 10 triggers، و72 سياسة RLS. جميع الجداول الـ37 مفعّل عليها RLS.
- private: ثلاث وظائف إضافية مسجلة في المخطط. public يحتوي 25 وظيفة؛ أي 28 وظيفة بين المخططين عند العدّ حسب pg_proc.
- Storage: الحاوية private-lesson-assets خاصة، حد الملف 5 MiB، وتقبل JPEG/PNG/WebP. الحاوية site-content عامة، حد الملف 50 MiB، وتقبل PDF ومستندات Office والصور المحددة. سياسات private-lesson-assets تقيد الإدارة بمدير الموقع وتتيح للطالب قراءة أصول الدروس المنشورة فقط. سياسات site-content تقيد عمليات الإدارة بمدير الموقع.
- لا توجد views في public/private بحسب information_schema.views.

### مشروع مجتمع الأساتذة
- public: أربعة جداول، 30 عمودًا، 17 قيدًا (9 CHECK و3 FOREIGN KEY و4 PRIMARY KEY و1 UNIQUE)، 11 فهرسًا، 4 triggers، و8 سياسات RLS.
- public يحتوي أربع وظائف؛ لا يوجد مخطط private ضمن الجرد التطبيقي لهذا المشروع.
- Storage: الحاوية teacher-community خاصة، حد الملف 50 MiB، وقائمة MIME محددة للمستندات والعروض والجداول والصور والنصوص وZIP. سياسات القراءة تشترط الملكية أو الإدارة أو عضوية معتمدة مع مورد منشور ومشترك؛ الرفع يشترط أن يكون مسار الملف داخل مجلد معرف المستخدم وعضوية معتمدة أو مديرًا؛ الحذف للمالك أو المدير.

### تفسير الجرد وحدوده
- الأعداد السابقة هي لقطة كتالوج حالية وليست تصدير SQL كاملًا؛ لا تشمل جميع خصائص PostgreSQL منخفضة المستوى مثل إعدادات الامتدادات والأدوار والـ publications والـ secrets، ولا تثبت تاريخ إنشاء كل عنصر.
- تم تجنب استخراج بيانات الصفوف. بعض أدوات استعراض الجداول تعرض تقديرات/أعداد صفوف كبيانات وصفية؛ لم تُستخدم تلك القيم لإعادة بناء أي بيانات.
- لا تزال هناك حاجة إلى schema-only export موثوق أو مصدر SQL تاريخي معتمد قبل إنشاء baseline قابل لإعادة التشغيل.
