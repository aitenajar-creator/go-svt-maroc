# هيكلية مجلدات Go SVT Maroc

هذا الملف يوضح الهيكلية الكاملة لمجلدات الموقع وكيفية استخدامها.

## 📁 الهيكلية الكاملة

```
free site/
├── index.html                          # الصفحة الرئيسية
├── styles.css                          # ملف التنسيقات
├── script.js                           # ملف الجافاسكريبت
├── README.md                           # ملف التوثيق الرئيسي
├── STRUCTURE.md                        # هذا الملف
│
├── cours/                              # مجلد الدروس
│   ├── francais/                       # الدروس بالفرنسية
│   │   ├── TC/
│   │   │   ├── TCS/                    # Tronc Commun Scientifique
│   │   │   │   └── README.md
│   │   │   └── TCL/                    # Tronc Commun Littéraire
│   │   │       └── README.md
│   │   ├── 1BAC/
│   │   │   ├── 1BACSE/                 # 1ère Bac Sciences Expérimentales
│   │   │   │   └── README.md
│   │   │   ├── 1BACSM/                 # 1ère Bac Sciences Mathématiques
│   │   │   │   └── README.md
│   │   │   └── 1BACL/                  # 1ère Bac Lettres
│   │   │       └── README.md
│   │   └── 2BAC/
│   │       ├── 2BACSVT/                # 2ème Bac SVT
│   │       │   └── README.md
│   │       ├── 2BACSP/                 # 2ème Bac Sciences Physiques
│   │       │   └── README.md
│   │       └── 2BACSM/                 # 2ème Bac Sciences Mathématiques
│   │           └── README.md
│   │
│   └── arabe/                          # الدروس بالعربية
│       ├── TC/
│       │   ├── TCS/
│       │   │   └── README.md
│       │   └── TCL/
│       │       └── README.md
│       ├── 1BAC/
│       │   ├── 1BACSE/
│       │   │   └── README.md
│       │   ├── 1BACSM/
│       │   │   └── README.md
│       │   └── 1BACL/
│       │       └── README.md
│       └── 2BAC/
│           ├── 2BACSVT/
│           │   └── README.md
│           ├── 2BACSP/
│           │   └── README.md
│           └── 2BACSM/
│               └── README.md
│
├── exercices/                          # مجلد التمارين
│   ├── francais/                       # التمارين بالفرنسية
│   │   ├── TC/
│   │   │   ├── TCS/
│   │   │   │   └── README.md
│   │   │   └── TCL/
│   │   │       └── README.md
│   │   ├── 1BAC/
│   │   │   ├── 1BACSE/
│   │   │   │   └── README.md
│   │   │   ├── 1BACSM/
│   │   │   │   └── README.md
│   │   │   └── 1BACL/
│   │   │       └── README.md
│   │   └── 2BAC/
│   │       ├── 2BACSVT/
│   │       │   └── README.md
│   │       ├── 2BACSP/
│   │       │   └── README.md
│   │       └── 2BACSM/
│   │           └── README.md
│   │
│   └── arabe/                          # التمارين بالعربية
│       ├── TC/
│       │   ├── TCS/
│       │   │   └── README.md
│       │   └── TCL/
│       │       └── README.md
│       ├── 1BAC/
│       │   ├── 1BACSE/
│       │   │   └── README.md
│       │   ├── 1BACSM/
│       │   │   └── README.md
│       │   └── 1BACL/
│       │       └── README.md
│       └── 2BAC/
│           ├── 2BACSVT/
│           │   └── README.md
│           ├── 2BACSP/
│           │   └── README.md
│           └── 2BACSM/
│               └── README.md
│
├── fiches/                             # مجلد الملاخصات
│   ├── francais/                       # الملاخصات بالفرنسية
│   │   ├── TC/
│   │   │   ├── TCS/
│   │   │   │   └── README.md
│   │   │   └── TCL/
│   │   │       └── README.md
│   │   ├── 1BAC/
│   │   │   ├── 1BACSE/
│   │   │   │   └── README.md
│   │   │   ├── 1BACSM/
│   │   │   │   └── README.md
│   │   │   └── 1BACL/
│   │   │       └── README.md
│   │   └── 2BAC/
│   │       ├── 2BACSVT/
│   │       │   └── README.md
│   │       ├── 2BACSP/
│   │       │   └── README.md
│   │       └── 2BACSM/
│   │           └── README.md
│   │
│   └── arabe/                          # الملاخصات بالعربية
│       ├── TC/
│       │   ├── TCS/
│       │   │   └── README.md
│       │   └── TCL/
│       │       └── README.md
│       ├── 1BAC/
│       │   ├── 1BACSE/
│       │   │   └── README.md
│       │   ├── 1BACSM/
│       │   │   └── README.md
│       │   └── 1BACL/
│       │       └── README.md
│       └── 2BAC/
│           ├── 2BACSVT/
│           │   └── README.md
│           ├── 2BACSP/
│           │   └── README.md
│           └── 2BACSM/
│               └── README.md
│
├── documents/                          # الوثائق التربوية
│   └── README.md
│
├── ressources/                         # الموارد المدرسية
│   └── README.md
│
└── divers/                             # متفرقات
    └── README.md
```

## 📤 كيفية إضافة الملفات

### لإضافة درس جديد:

1. **اختر نوع المحتوى:**
   - `cours/` للدروس
   - `exercices/` للتمارين
   - `fiches/` للملاخصات

2. **اختر اللغة:**
   - `francais/` للمحتوى بالفرنسية
   - `arabe/` للمحتوى بالعربية

3. **اختر المستوى:**
   - `TC/` للتربوع المشترك
   - `1BAC/` للسنة الأولى باكالوريا
   - `2BAC/` للسنة الثانية باكالوريا

4. **اختر التخصص:**
   - للـ TC: `TCS` أو `TCL`
   - للـ 1BAC: `1BACSE` أو `1BACSM` أو `1BACL`
   - للـ 2BAC: `2BACSVT` أو `2BACSP` أو `2BACSM`

5. **ضع الملف في المجلد المناسب**

### مثال عملي:

لإضافة درس بالفرنسية لمستوى TC TCS:
```
cours/francais/TC/TCS/La_cellule_animale.pdf
```

لإضافة تمرين بالعربية لمستوى 2BAC SVT:
```
exercices/arabe/2BAC/2BACSVT/تمرين_الوراثة.pdf
```

لإضافة ملخص بالفرنسية لمستوى 1BAC SE:
```
fiches/francais/1BAC/1BACSE/Fiche_Respiration.pdf
```

## 📝 التنسيقات المدعومة

- **PDF** - الملفات النصية والمستندات
- **DOCX** - ملفات Microsoft Word
- **PPTX** - عروض PowerPoint (للدروس)
- **MP4** - فيديوهات (للموارد)
- **JPG/PNG** - صور (للمتفرقات)

## 🎯 الإذن باستخدام المجلدات

تم منحك الإذن الكامل بوضع المستندات حسب التصنيف المحدد. يمكنك:
- إضافة ملفات PDF و DOCX في المجلدات المناسبة
- إنشاء مجلدات فرعية إضافية إذا لزم الأمر
- تعديل ملفات README الموجودة حسب الحاجة
- حذف ملفات README إذا لم تكن بحاجة إليها

## 📞 الدعم

للمساعدة أو الاستفسارات، يرجى التواصل عبر:
- البريد الإلكتروني: aitenajar@gmail.com
- رقم الهاتف: 0678723739

---

**Go SVT Maroc** - منصة تعليمية متكاملة 🎓
