# كيفية إضافة روابط الملفات في الموقع

## 📤 إضافة ملفات جديدة

### الخطوة 1: رفع الملفات إلى GitHub

1. **اذهب إلى المستودع:**
   - https://github.com/aitenajar-creator/go-svt-maroc

2. **اختر المجلد المناسب:**
   - للدروس: `cours`
   - للتمارين: `exercices`
   - للملاخصات: `fiches`

3. **مثال: رفع درس بالفرنسية لمستوى TC TCS**
   - اضغط على `cours`
   - اضغط على `francais`
   - اضغط على `TC`
   - اضغط على `TCS`
   - اضغط على **"Add file"** > **"Upload files"**
   - اسحب ملف الدرس وأفلته
   - اكتب رسالة: "Add lesson - [اسم الدرس]"
   - اضغط **"Commit changes"**

### الخطوة 2: إضافة رابط الملف في الكود

بعد رفع الملف، يجب إضافة رابطه في ملف `script.js`:

1. **افتح ملف `script.js`**

2. **ابحث عن القسم المناسب:**
   - للدروس: ابحث عن `siteData.cours`
   - للتمارين: ابحث عن `siteData.exercices`
   - للملاخصات: ابحث عن `siteData.fiches`

3. **أضف مسار الملف:**

   **مثال:**
   ```javascript
   { title: "Chapitre 1", description: "وصف الدرس", file: "cours/francais/TC/TCS/Chapitre 1/eleves-TCS  AIT ENAJAR U1C1.pdf" }
   ```

   **بدون ملف:**
   ```javascript
   { title: "عنوان", description: "وصف", file: "" }
   ```

4. **احفظ الملف**

5. **ارفع التعديلات إلى GitHub:**
   ```bash
   git add script.js
   git commit -m "Add file link for [اسم الدرس]"
   git push
   ```

6. **انتظر دقيقة** وسيتم تحديث الموقع تلقائياً

## 📋 مثال عملي

### رفع درس جديد وإضافة رابطه:

1. **ارفع الملف:**
   - المجلد: `cours/francais/TC/TCS/`
   - اسم الملف: `La_cellule_animale.pdf`

2. **عدّل `script.js`:**
   ```javascript
   TCS: [
       { title: "Chapitre 1", description: "Étude de la structure et des fonctions de la cellule animale", file: "cours/francais/TC/TCS/La_cellule_animale.pdf" },
       // ... بقية الدروس
   ]
   ```

3. **ارفع التعديلات:**
   ```bash
   git add script.js
   git commit -m "Add link for La cellule animale"
   git push
   ```

4. **انتظر دقيقة** وسيظهر الرابط في الموقع!

## 🎯 قواعد مهمة

### تسمية الملفات:
- استخدم أسماء واضحة
- تجنب المسافات الزائدة
- الملفات التي تحتوي على مسافات يجب أن تكون محاطة بعلامات اقتباس في المسار

### مسارات الملفات:
- المسار يبدأ دائماً باسم المجلد الرئيسي (cours, exercices, fiches)
- اللغة (francais/arabe)
- المستوى (TC, 1BAC, 2BAC)
- التخصص (TCS, TCL, 1BACSE, إلخ)
- اسم الملف

### مثال المسار:
```
cours/francais/TC/TCS/La_cellule_animale.pdf
exercices/arabe/2BAC/2BACSVT/تمرين_الوراثة.pdf
fiches/francais/1BAC/1BACSE/Fiche_Respiration.pdf
```

## 🔧 كيفية تحديث الكود بسهولة

### الطريقة 1: تعديل مباشر على GitHub

1. اذهب إلى المستودع
2. اضغط على ملف `script.js`
3. اضغط على زر القلم (edit)
4. عدّل الكود
5. اضغط "Commit changes"

### الطريقة 2: تعديل محلي ثم رفع

1. عدّل الملف على جهازك
2. افتح Git Bash أو Terminal
3. نفذ:
   ```bash
   cd "C:\Users\PC\Desktop\MES APPLICATION\free site"
   git add script.js
   git commit -m "Update file links"
   git push
   ```

## 📞 المساعدة

إذا واجهت أي مشاكل:
- البريد: aitenajar@gmail.com
- الهاتف: 0678723739

---

**ملاحظة:** الملفات الموجودة حالياً في الموقع (Chapitre 1, 2, 3) مرتبطة بالفعل وتعمل بشكل صحيح!
