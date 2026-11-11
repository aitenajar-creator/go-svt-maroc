# إعداد مشروع مجتمع الأساتذة — GO SVT Maroc

## بنية مستقلة فعلياً
مجتمع الأساتذة يعمل على مشروع Supabase ثانٍ مستقل عن المشروع الحالي للمدير والتلاميذ وفضاء الأقسام. هذا يتيح إنشاء حساب أستاذ مستقل حتى إذا استعمل الأستاذ البريد نفسه في فضاء التلميذ.

لا تغيّر إعدادات أو جداول مشروع Supabase الحالي.

## 1. إنشاء مشروع Supabase جديد
1. من لوحة Supabase أنشئ مشروعاً جديداً باسم مثل `gosvt-teacher-community`.
2. اختر كلمة مرور قوية لقاعدة البيانات واحتفظ بها في مكان آمن.
3. من Project Settings → API انسخ Project URL ومفتاح Publishable (أو anon public key).
4. افتح ملف `teacher-community-config.js` في هذا المستودع، واستبدل القيمتين النموذجيتين بعنوان المشروع الجديد ومفتاحه العام. لا تضع service_role أو secret key في هذا الملف.

## 2. إعداد Auth
في المشروع الجديد:
- Authentication → Providers → Email: فعّل البريد الإلكتروني.
- Authentication → URL Configuration: اجعل Site URL عنوان صفحة `teacher-community.html` على موقع GO SVT Maroc.
- أضف رابط `https://gosvtmaroc.com/teacher-community.html` إلى Redirect URLs (وأضف رابط المعاينة إن احتجته).

## 3. إنشاء الجداول والتخزين
1. افتح SQL Editor في مشروع الأساتذة الجديد.
2. انسخ ونفّذ الملف `supabase/migrations/20261111000100_teacher_community_library.sql` كاملاً.
3. ينشئ السكربت جدول المشرفين والأعضاء والموارد، وسياسات RLS، وbucket خاصاً باسم `teacher-community`.
4. لا تنفّذ هذا الملف في مشروع Supabase الحالي الخاص بالتلاميذ.

## 4. تعيين حسابك مديراً لمجتمع الأساتذة
1. افتح صفحة `https://gosvtmaroc.com/teacher-community.html`.
2. أنشئ حساباً جديداً ببريدك وكلمة مرور تختارها لمجتمع الأساتذة، وأكمل تأكيد البريد إن كان مفعلاً.
3. سجّل الدخول مرة واحدة حتى ينشأ مستخدم Auth.
4. في SQL Editor للمشروع الجديد نفّذ الاستعلام التالي بعد استبدال البريد ببريد حسابك:

```sql
insert into public.teacher_community_admins (user_id)
select id from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (user_id) do nothing;
```

5. سجّل الخروج ثم الدخول من جديد. سيظهر تبويب «إدارة المجتمع».

## 5. طريقة العمل
- يسجل الأستاذ في المشروع الجديد، وينشأ طلب عضوية pending.
- أنت توافق على الطلب من لوحة «إدارة المجتمع».
- بعد الموافقة، يستطيع الأستاذ رؤية المكتبة ورفع ملفات PDF وWord وPowerPoint وExcel وغيرها، ومشاركتها أو إبقاؤها خاصة.
- يستطيع الأستاذ تعديل/حذف موارده فقط؛ المدير يشرف على كل الموارد ويستطيع إخفاءها أو حذفها.
- التحميل يتم بروابط موقعة قصيرة الأجل من bucket خاص، وليس بروابط عامة.

## الصيغ والحجم
PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ODT, ODP, JPG, JPEG, PNG, WEBP, TXT, ZIP.
الحد الأقصى 50 MB للملف.

## الأمان
- لا تضع service_role أو secret key في JavaScript.
- مفتاح Publishable فقط في الواجهة، مع اعتماد RLS وسياسات Storage.
- لا تغيّر أدوار حسابات الموقع الحالي أو جداول الطلاب.
- قبل الإعلان عن تفعيل النظام، اختبره بحساب مدير وحساب أستاذ تجريبي، وتحقق من منع الأستاذ من تعديل ملفات الآخرين.
