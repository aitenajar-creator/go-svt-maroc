# حزمة مراجعات وتحسينات Go SVT Maroc

## الحالة الفعلية

هذه تغييرات أُعدت واختُبرت محليًا. **لم تُرفع إلى GitHub، ولم يُنشأ commit أو pull request، ولم تُطبّق أي ترحيلات على قاعدة بيانات الإنتاج.** لا توجد جلسة GitHub مُصدّقة في بيئة إعداد الحزمة.

أساس الحزمة: `83ade7b4c7cfccbea96716dc46e58da30fe51342`، مع الحفاظ على التحديثات الأحدث من المراجعة الأصلية. توجد معالجة للملاحظات البرمجية والاختبارات والتوثيق، لكن استكمال المخطط التأسيسي الحقيقي للمشروع الرئيسي ما زال معلقًا؛ لم تُختلق تعريفات إنتاجية مفقودة.

## المحتويات

- `go-svt-maroc-review-improvements.patch`: التعديلات والإضافات بصيغة Git patch.
- `files/`: الملفات المعدلة والجديدة فقط، بمساراتها داخل المستودع. ليست نسخة كاملة من الموقع، ولا تتضمن ملفات PDF أو `node_modules` أو `.git`.
- `VALIDATION.json` و`validation-log.txt`: نتائج الفحوص المحلية.
- داخل الملفات: `docs/REVIEW_IMPROVEMENTS_AR.md` يتابع الملاحظات الـ21، و`docs/DATABASE_DEPLOYMENT_AR.md` يشرح ترقية قاعدة البيانات وحدودها.

## التطبيق الموصى به

**استخدم فرع مراجعة؛ لا تنشر الواجهة الجديدة مباشرة إلى main قبل تجهيز قاعدة البيانات.**

على جهاز توجد عليه صلاحية الوصول إلى المستودع، استخدم نسخة نظيفة أو احفظ عملك الحالي أولًا:

```sh
git clone https://github.com/aitenajar-creator/go-svt-maroc.git
cd go-svt-maroc
git switch -c fix/review-improvements
git apply --check /PATH/TO/go-svt-maroc-review-improvements.patch
git apply /PATH/TO/go-svt-maroc-review-improvements.patch
npm ci --ignore-scripts
npm test
npx playwright install --with-deps chromium
npm run test:browser
python3 scripts/check-site.py
```

استبدل `/PATH/TO/` بمكان الملف. إذا فشل `git apply --check`، فتوقف وراجع اختلاف النسخة الحالية؛ لا تستخدم استبدالًا قسريًا أو `git reset --hard`. الحزمة لا تضمن التطبيق دون تعارض على تغييرات مستقبلية.

بعد مراجعة `git diff` والاختبارات، يمكن إنشاء commit ورفع الفرع من الحساب المخوّل. عند استخدام واجهة GitHub بدل Git، تُرفع **محتويات `files/` إلى المسارات المناظرة في فرع جديد**؛ لا ترفع مجلد `files` بوصفه مجلدًا إضافيًا داخل الموقع.

## قبل النشر الإنتاجي

1. الحصول على نسخة احتياطية ومراجعة مخطط المشروع الرئيسي الفعلي؛ المخطط التأسيسي الكامل غير مرفق في المستودع.
2. اختبار الترحيلات الجديدة على staging، ثم تطبيقها بإجراء إداري معتمد **قبل** نشر الواجهة:
   - `20261125000100_student_collection_deletions.sql`
   - `20261125000200_per_lesson_objectives.sql`
   - `20261125000300_atomic_teacher_question_replies.sql`
3. هذه الملفات للمشروع الرئيسي فقط. مجتمع الأساتذة مشروع مستقل؛ راجع `supabase/project-manifest.json`.
4. اختبار Auth وPostgREST وStorage والأدوار على staging. اختبارات PGlite تستخدم مخططًا اصطناعيًا وليست إثباتًا لحالة الإنتاج.
5. بعد النشر، إعادة تحميل التبويبات القديمة للتأكد من استعمال بروتوكولات المزامنة الجديدة.

لا تُستخدم `tests/fixtures/database.sql` على الإنتاج، ولا تُحذف جداول علامات الحذف أو الأهداف الجديدة عند التراجع عن الواجهة. التفاصيل في دليل قاعدة البيانات.
