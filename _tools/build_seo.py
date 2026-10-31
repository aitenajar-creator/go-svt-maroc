#!/usr/bin/env python3
"""
Go SVT Maroc - générateur SEO
=============================
Lit les dossiers cours/ exercices/ fiches/ et produit, à chaque déploiement :

  * svt/...            pages HTML statiques indexables (une par type/niveau/filière)
                       -> les titres de cours et les examens deviennent visibles
                          pour Google (le site principal charge tout en JavaScript)
  * sitemap.xml        toutes les pages + les PDF, avec <lastmod> et hreflang
  * index.html         remplit le bloc entre <!-- SEO-LINKS:START --> et
                       <!-- SEO-LINKS:END --> avec des liens HTML classiques
                       vers ces pages (Google suit les <a href>, pas le JS)

Usage :   python3 _tools/build_seo.py          (aucune dépendance, stdlib seule)

Titres lisibles des cours : modifier _tools/seo-titles.json (voir README_SEO.md).
Le script est idempotent : on peut le relancer autant de fois que l'on veut.
"""
import datetime
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://gosvtmaroc.com"
OUT = "svt"                                   # dossier des pages générées
CONTENT_TYPES = ["cours", "exercices", "fiches", "resumes", "examens"]
DOC_EXT = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"}
MIN_BYTES = 2048                              # ignore les fichiers factices (ex. "Examens Nationaux" = 1 octet)
MIN_ITEMS = 2                                 # pas de page "maigre" sous ce nombre de fichiers
SUBJECTS = {"francais": "fr", "arabe": "ar"}

# --------------------------------------------------------------------------
# Libellés
# --------------------------------------------------------------------------
LEVELS = {
    "TC":   {"slug": "tc",   "fr": "TC",   "fr_long": "Tronc Commun",       "ar": "جذع مشترك"},
    "1BAC": {"slug": "1bac", "fr": "1BAC", "fr_long": "1ère Bac",           "ar": "الأولى باكالوريا"},
    "2BAC": {"slug": "2bac", "fr": "2BAC", "fr_long": "2ème Bac",           "ar": "الثانية باكالوريا"},
}
BRANCHES = {
    "TCS":     {"slug": "tc-sciences", "fr": "TC Sciences",  "fr_long": "Tronc Commun Scientifique (TCS)",                        "ar": "جذع مشترك علمي"},
    "TCL":     {"slug": "tc-lettres",  "fr": "TC Lettres",   "fr_long": "Tronc Commun Lettres (TCL)",                             "ar": "جذع مشترك آداب"},
    "1BACSE":  {"slug": "1bac-se",     "fr": "1BAC SE",      "fr_long": "1ère Bac Sciences Expérimentales (1BAC SE)",             "ar": "الأولى باكالوريا علوم تجريبية"},
    "1BACSM":  {"slug": "1bac-sm",     "fr": "1BAC SM",      "fr_long": "1ère Bac Sciences Mathématiques (1BAC SM)",              "ar": "الأولى باكالوريا علوم رياضية"},
    "1BACL":   {"slug": "1bac-lettres","fr": "1BAC Lettres", "fr_long": "1ère Bac Lettres (1BAC L)",                              "ar": "الأولى باكالوريا آداب"},
    "2BACSVT": {"slug": "2bac-svt",    "fr": "2BAC SVT",     "fr_long": "2ème Bac Sciences de la Vie et de la Terre (2BAC SVT)",  "ar": "الثانية باكالوريا علوم الحياة والأرض"},
    "2BACSM":  {"slug": "2bac-sm",     "fr": "2BAC SM",      "fr_long": "2ème Bac Sciences Mathématiques (2BAC SM)",              "ar": "الثانية باكالوريا علوم رياضية"},
    "2BACSP":  {"slug": "2bac-sp",     "fr": "2BAC SP",      "fr_long": "2ème Bac Sciences Physiques (2BAC SP)",                  "ar": "الثانية باكالوريا علوم فيزيائية"},
}
TYPE_LABEL = {
    "fr": {"cours": "Cours de SVT", "exercices": "Exercices de SVT", "fiches": "Fiches et résumés de SVT",
           "resumes": "Résumés de SVT", "quiz": "Quiz de SVT", "examens": "Examens nationaux de SVT"},
    "ar": {"cours": "دروس علوم الحياة والأرض", "exercices": "تمارين علوم الحياة والأرض",
           "fiches": "جذاذات وملخصات علوم الحياة والأرض", "resumes": "ملخصات علوم الحياة والأرض",
           "quiz": "اختبارات علوم الحياة والأرض", "examens": "الامتحانات الوطنية في علوم الحياة والأرض"},
}
TYPE_ORDER = ["cours", "exercices", "fiches", "resumes", "quiz", "examens"]
EXAM_RE = re.compile(
    r"examen-national-svt-.+?-(?P<year>20\d{2})-(?P<session>normale|rattrapage)-(?P<kind>sujet|corrige)",
    re.I)
BRAND = "Go SVT Maroc"


def branch_code(folders, filename):
    """Filière d'un examen : d'abord un dossier du chemin (« 2BAC SP » -> 2BACSP), sinon le nom du fichier."""
    for c in folders:
        key = re.sub(r"[\s_\-]+", "", c).upper()
        if key in BRANCHES:
            return key
    low = filename.lower()
    if "physiques" in low:
        return "2BACSP"
    if "maths" in low:
        return "2BACSM"
    if "2eme-bac-svt" in low or "2bac-svt" in low:
        return "2BACSVT"
    return None


def scope_info(scope):
    """scope = nom de filière (2BACSVT) ou de niveau (2BAC)."""
    if scope in BRANCHES:
        return BRANCHES[scope]
    if scope in LEVELS:
        return LEVELS[scope]
    slug = re.sub(r"[^a-z0-9]+", "-", scope.lower()).strip("-") or "autre"
    return {"slug": slug, "fr": scope, "fr_long": scope, "ar": scope}


# --------------------------------------------------------------------------
# Outils
# --------------------------------------------------------------------------
def natural_key(s):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", s)]


def md5(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def url_path(rel_parts):
    return "/" + "/".join(quote(p) for p in rel_parts)


def human_size(n, lang):
    mb = n / (1024 * 1024)
    if mb >= 1:
        s = f"{mb:.1f}"
        return (s.replace(".", ",") + " Mo") if lang == "fr" else (s + " MB")
    kb = max(1, round(n / 1024))
    return f"{kb} Ko" if lang == "fr" else f"{kb} KB"


def git_date(path):
    """Date du dernier commit touchant ce fichier ; sinon date de modification."""
    try:
        out = subprocess.run(
            ["git", "-c", "core.quotepath=off", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=20)
        d = out.stdout.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            return d
    except Exception:
        pass
    return datetime.date.fromtimestamp(path.stat().st_mtime).isoformat()


def clean_filename_title(name):
    t = re.sub(r"\.[^.]+$", "", name)
    t = re.sub(r"[_]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def load_titles():
    p = ROOT / "_tools" / "seo-titles.json"
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"!! seo-titles.json invalide : {e}", file=sys.stderr)
        return {}
    return {k: v for k, v in data.items() if not k.startswith("_")}


# --------------------------------------------------------------------------
# Scan des fichiers
# --------------------------------------------------------------------------
class Item:
    def __init__(self, path, parts, size, digest):
        self.path = path
        self.parts = parts              # chemin relatif (liste)
        self.name = parts[-1]
        self.size = size
        self.digest = digest
        self.url = url_path(parts)
        self.title = None
        self.group = None
        self.order = 999
        self.exam = None                # (year, session, kind)
        self.date = None
        self.meta = None                # texte à droite dans les listes (défaut : « PDF · taille »)
        self.mime = "application/pdf"   # None pour une page HTML (quiz)
        self.indexable = True           # False : absent du sitemap


def scan(titles):
    groups = defaultdict(list)          # (type, lang, scope) -> [Item]
    used_keys = set()
    for ctype in CONTENT_TYPES:
        base = ROOT / ctype
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            if not p.is_file() or p.name.startswith("."):
                continue
            if p.suffix.lower() not in DOC_EXT:
                continue
            rel = p.relative_to(ROOT).parts
            if len(rel) < 4 or rel[1] not in SUBJECTS:      # type/langue/niveau/fichier minimum
                continue
            size = p.stat().st_size
            if size < MIN_BYTES:
                continue
            lang = SUBJECTS[rel[1]]
            level = rel[2]
            m = EXAM_RE.search(p.name)
            if ctype == "examens" or (ctype == "exercices" and m):
                page_type = "examens"
                scope = branch_code(rel[3:-1], p.name) or level
            else:
                page_type = ctype
                scope = rel[3] if len(rel) >= 5 else level          # filière si sous-dossier, sinon niveau
            it = Item(p, list(rel), size, md5(p))
            if m:
                it.exam = (int(m["year"]), m["session"].lower(), m["kind"].lower())
            ov = titles.get(it.name)
            if ov is not None:
                used_keys.add(it.name)
                if isinstance(ov, str):
                    it.title = ov
                else:
                    it.title = ov.get("title")
                    it.group = ov.get("group")
                    it.order = ov.get("order", 999)
            if not it.title:
                it.title = clean_filename_title(it.name)
            groups[(page_type, lang, scope)].append(it)
    unknown = set(titles) - used_keys
    for k in sorted(unknown):
        print(f"   ! seo-titles.json : aucun fichier nommé « {k} »", file=sys.stderr)
    return groups


def dedupe(items):
    """Garde un seul exemplaire des fichiers identiques (même contenu)."""
    by_digest = defaultdict(list)
    for it in items:
        by_digest[it.digest].append(it)
    kept = []
    for dup in by_digest.values():
        dup.sort(key=lambda i: (bool(re.search(r"\(\d+\)", i.name)), len(i.parts), i.name))
        kept.append(dup[0])
    return kept


# --------------------------------------------------------------------------
# Modèle de page
# --------------------------------------------------------------------------
class Page:
    def __init__(self, ptype, lang, scope, items, ui=None):
        # lang = langue des FICHIERS ; ui = langue du TEXTE de la page (jumelle arabe d'une page française : ui="ar")
        self.type, self.lang, self.scope = ptype, lang, scope
        self.ui = ui or lang
        self.is_twin = self.ui != self.lang
        self.items = items
        self.info = scope_info(scope)
        self.path = (f"/{OUT}/{self.ui}/{ptype}/{self.info['slug']}/" if self.is_twin
                     else f"/{OUT}/{ptype}/{lang}/{self.info['slug']}/")
        self.url = SITE + self.path
        self.label = self.info["ar"] if self.ui == "ar" else self.info["fr"]
        self.label_long = self.info["ar"] if self.ui == "ar" else self.info["fr_long"]
        self.alternates = {}
        self.lastmod = None
        years = sorted({i.exam[0] for i in items if i.exam})
        self.years = (years[0], years[-1]) if years else None
        self.build_texts()

    def build_texts(self):
        L, T = self.ui, TYPE_LABEL[self.ui][self.type]
        note = " وهي مكتوبة باللغة الفرنسية" if self.is_twin else ""        # page arabe pour des fichiers en français : on le dit
        if L == "ar" and "علوم الحياة والأرض" in self.label_long:      # évite la répétition du nom de la matière
            T = re.sub(r"\s*(في\s+)?علوم الحياة والأرض", "", T)
        n = len(self.items)
        if self.type == "quiz":
            n = len(self.items)
            if L == "fr":
                self.h1 = f"Quiz de SVT {self.label} : {n} QCM corrigés"
                self.title = f"QCM SVT {self.label} corrigés avec explications | {BRAND}"
                self.desc = (f"{n} quiz de SVT pour {self.label_long} : QCM avec la bonne réponse et l'explication de chaque question, "
                             f"gratuits, à lire en ligne ou à faire en mode interactif.")
                self.intro = (f"Quiz de SVT du niveau {self.label_long} : chaque page présente les questions, les choix, la bonne réponse "
                              f"et son explication. Vous pouvez aussi les faire en mode interactif sur la plateforme.")
            else:
                self.h1 = f"{T} {self.label_long} : {n} اختباراً مصححاً"
                self.title = f"{T} {self.label_long} مصححة مع الشرح | {BRAND}"
                self.desc = (f"{n} اختباراً في علوم الحياة والأرض لمسلك {self.label_long} : أسئلة من متعدد مع الإجابة الصحيحة والشرح"
                             + (" (الأسئلة بالفرنسية)." if self.is_twin else "."))
                self.intro = (f"اختبارات علوم الحياة والأرض لمسلك {self.label_long} : تعرض كل صفحة الأسئلة والاختيارات والإجابة الصحيحة وشرحها"
                              + ((note + ".") if note else ".") + " ويمكنك أيضاً إجراؤها بشكل تفاعلي على المنصة.")
        elif self.type == "examens" and self.years:
            y0, y1 = self.years
            yr = f"{y0}-{y1}" if y0 != y1 else f"{y0}"
            if L == "fr":
                self.h1 = f"{T} {self.label} ({yr}) : sujets et corrigés PDF"
                self.title = f"Examens nationaux SVT {self.label} {yr} : sujets et corrigés | {BRAND}"
                self.desc = (f"Examens nationaux de SVT {self.label} de {y0} à {y1} : sujets et corrigés des sessions "
                             f"normale et de rattrapage, à télécharger gratuitement en PDF.")
                self.intro = (f"Sujets et corrigés (lorsqu'ils sont disponibles) des examens nationaux de SVT pour "
                              f"{self.label_long}, de {y0} à {y1}, sessions normale et de rattrapage. "
                              f"Tous les fichiers sont en PDF et gratuits.")
            else:
                self.h1 = f"{T} {self.label_long} ({yr}) : مواضيع وتصحيحات PDF"
                self.title = f"{self.h1} | {BRAND}"
                self.desc = (f"مواضيع وتصحيحات الامتحانات الوطنية في علوم الحياة والأرض {self.label_long} "
                             f"من {y0} إلى {y1}، الدورتان العادية والاستدراكية، تحميل مجاني بصيغة PDF.")
                self.intro = (f"مواضيع الامتحانات الوطنية في علوم الحياة والأرض لمسلك {self.label_long} من {y0} إلى {y1}، "
                              f"مع التصحيحات حيثما توفرت، للدورتين العادية والاستدراكية. جميع الملفات بصيغة PDF ومجانية" + (("، " + note.strip() + ".") if note else "."))
        else:
            if L == "fr":
                self.h1 = f"{T} {self.label} : {n} fichiers PDF"
                self.title = f"{T} {self.label} en PDF | {BRAND}"
                self.desc = self.fit_desc(f"{T} {self.label_long} : {n} fichiers PDF à télécharger gratuitement.",
                                          " Au programme : ", "; ")
                self.intro = (f"Retrouvez ici les documents « {T.lower()} » du niveau {self.label_long}, "
                              f"au format PDF et gratuits. La liste s'enrichit à mesure que de nouveaux fichiers sont ajoutés.")
            else:
                self.h1 = f"{T} {self.label_long} : {n} ملفات PDF"
                self.title = f"{T} {self.label_long} - تحميل PDF | {BRAND}"
                base = f"{T} لمسلك {self.label_long} : {n} ملفات PDF للتحميل المجاني."
                self.desc = base + (" الملفات بالفرنسية." if self.is_twin else "") if self.is_twin else self.fit_desc(base, " ", "؛ ")
                self.intro = (f"ملفات «{T}» لمسلك {self.label_long} بصيغة PDF ومجانية،{note or ''}. " if note else
                              f"ملفات «{T}» لمسلك {self.label_long} بصيغة PDF ومجانية. ") + "تتزايد القائمة كلما أُضيفت ملفات جديدة."
        self.desc = self.desc.strip()
        if len(self.desc) > 160:
            self.desc = self.desc[:157].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"

    def fit_desc(self, base, lead, sep, limit=160):
        """Base + titres de chapitres, tant que la description tient dans la limite (sans coupure moche)."""
        ordered = sorted(self.items, key=lambda i: (i.order, natural_key(i.name)))
        names = []
        for i in ordered:
            nm = re.sub(r"^Unité \d+ : ", "", i.group) if i.group else re.sub(r"^Chapitre \d+ : ", "", i.title)
            if nm not in names:
                names.append(nm)
        out, picked = base, []
        for nm in names:
            trial = base + lead + sep.join(picked + [nm]) + "."
            if len(trial) > limit:
                break
            picked.append(nm)
        return base + lead + sep.join(picked) + "." if picked else base


# --------------------------------------------------------------------------
# HTML
# --------------------------------------------------------------------------
CSS = """
:root{--c1:#2d5a27;--bg:#f8f9fa;--card:#fff;--tx:#222;--mut:#5f6b5f;--bd:#e3e8e3;--ac:#2d5a27}
@media (prefers-color-scheme:dark){:root{--bg:#121712;--card:#1b231b;--tx:#e8ece8;--mut:#a9b5a9;--bd:#2c382c;--ac:#97bc62}}
*{box-sizing:border-box}
body{margin:0;font-family:'Cairo',system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.7;color:var(--tx);background:var(--bg)}
a{color:var(--ac)}
.w{max-width:960px;margin:0 auto;padding:0 20px}
.hd{background:linear-gradient(135deg,#2d5a27,#4f8a3f);padding:.8rem 0}
.hd .w{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.brand{color:#fff;font-weight:700;font-size:1.25rem;text-decoration:none}
.nav a{color:#fff;margin-inline-start:1.1rem;text-decoration:none;font-size:.95rem}
.nav a:hover{text-decoration:underline}
.crumbs{font-size:.85rem;color:var(--mut);margin:1rem 0 0}
.crumbs a{color:var(--mut)}
h1{font-size:1.55rem;line-height:1.4;color:var(--ac);margin:.5rem 0}
h2{font-size:1.15rem;margin:1.8rem 0 .6rem;color:var(--ac)}
.intro{color:var(--mut);margin:.2rem 0 1.2rem}
.list{list-style:none;padding:0;margin:0;display:grid;gap:.6rem}
.list li{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:.7rem 1rem;display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
.list a{font-weight:600;text-decoration:none}
.list a:hover{text-decoration:underline}
.meta{color:var(--mut);font-size:.82rem;white-space:nowrap}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--bd)}
th,td{padding:.55rem .7rem;border-bottom:1px solid var(--bd);text-align:center;white-space:nowrap}
th{background:rgba(45,90,39,.12);font-size:.9rem}
td:first-child{font-weight:700}
.cta{display:inline-block;margin:1.4rem 0 .4rem;padding:.65rem 1.2rem;background:var(--c1);color:#fff;border-radius:8px;text-decoration:none;font-weight:600}
.rel ul{padding-inline-start:1.2rem;margin:.3rem 0}
.ft{margin-top:2.5rem;padding:1.2rem 0;border-top:1px solid var(--bd);color:var(--mut);font-size:.88rem}
.qs{list-style:none;padding:0;margin:1rem 0}
.q{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:.9rem 1.1rem;margin:0 0 .9rem}
.q .qt{font-weight:700;margin:0 0 .5rem}
.ch{list-style:none;padding:0;margin:.3rem 0 .6rem}
.ch li{padding:.15rem 0}
.q summary{cursor:pointer;color:var(--ac);font-weight:600}
.q details p{margin:.4rem 0}
.note{background:rgba(255,193,7,.15);border:1px solid rgba(255,193,7,.55);border-radius:8px;padding:.5rem .9rem;font-size:.88rem;margin:.8rem 0}
.acts a{margin-inline-end:.8rem}
.ql{margin-inline-start:.6rem;font-size:.85rem;font-weight:600;white-space:nowrap}
"""

UI = {
    "fr": {"home": "Accueil", "hub": "Cours et examens", "all": "Toutes les ressources", "open": "Accéder à la plateforme complète",
           "related": "Voir aussi", "files": "fichiers", "year": "Année",
           "n_sujet": "Normale · Sujet", "n_corr": "Normale · Corrigé", "r_sujet": "Rattrapage · Sujet", "r_corr": "Rattrapage · Corrigé",
           "sujet": "Sujet", "corr": "Corrigé", "other_lang": "العربية", "rights": "Tous droits réservés.",
           "q_cta": "Passer ce quiz en mode interactif", "q_answer": "Voir la réponse", "q_correct": "Bonne réponse", "q_explain": "Explication",
           "q_lesson": "Télécharger le cours (PDF)", "q_other": "Autres quiz", "q_contact": "Signaler une erreur", "qlink": "🎯 Quiz",
           "q_auto": "Quiz généré automatiquement à partir du cours, puis relu par une seconde vérification. Si vous repérez une erreur, merci de nous la signaler."},
    "ar": {"home": "الرئيسية", "hub": "الدروس والامتحانات", "all": "جميع الموارد", "open": "الانتقال إلى المنصة الكاملة",
           "related": "روابط ذات صلة", "files": "ملفات", "year": "السنة",
           "n_sujet": "العادية · الموضوع", "n_corr": "العادية · التصحيح", "r_sujet": "الاستدراكية · الموضوع", "r_corr": "الاستدراكية · التصحيح",
           "sujet": "الموضوع", "corr": "التصحيح", "other_lang": "Français", "rights": "جميع الحقوق محفوظة.",
           "q_cta": "أجرِ هذا الاختبار بشكل تفاعلي", "q_answer": "عرض الإجابة", "q_correct": "الإجابة الصحيحة", "q_explain": "الشرح",
           "q_lesson": "تحميل الدرس (PDF)", "q_other": "اختبارات أخرى", "q_contact": "الإبلاغ عن خطأ", "qlink": "🎯 اختبار",
           "q_auto": "اختبار مولَّد آلياً من الدرس ومراجَع بتمريرة تحقق ثانية. إن وجدت خطأً فيرجى إبلاغنا."},
}


def e(s):
    return html.escape(str(s), quote=True)


def head(title, desc, canonical, lang, alternates=None, robots="index,follow,max-image-preview:large", jsonld=None):
    alt = ""
    if alternates and len(alternates) > 1:
        for lg, u in sorted(alternates.items()):
            alt += f'<link rel="alternate" hreflang="{lg}" href="{e(u)}">\n'
        alt += f'<link rel="alternate" hreflang="x-default" href="{e(alternates.get("fr", canonical))}">\n'
    ld = ""
    if jsonld:
        ld = '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>\n"
    loc = "fr_FR" if lang == "fr" else "ar_MA"
    return f"""<!DOCTYPE html>
<html lang="{lang}" dir="{'rtl' if lang == 'ar' else 'ltr'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{e(canonical)}">
{alt}<meta name="theme-color" content="#2d5a27">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:locale" content="{loc}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(canonical)}">
<meta property="og:image" content="{SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
{ld}<style>{CSS}</style>
</head>
"""


def shell(lang, crumbs, body, other_lang_url=None):
    u = UI[lang]
    sw = f'<a href="{e(other_lang_url)}" hreflang="{"ar" if lang == "fr" else "fr"}">{u["other_lang"]}</a>' if other_lang_url else ""
    cr = " › ".join(f'<a href="{e(h)}">{e(t)}</a>' if h else e(t) for t, h in crumbs)
    return f"""<body>
<header class="hd"><div class="w">
<a class="brand" href="/">🔬 {BRAND}</a>
<nav class="nav"><a href="/">{u['home']}</a><a href="/{OUT}/">{u['hub']}</a>{sw}</nav>
</div></header>
<main class="w">
<nav class="crumbs" aria-label="breadcrumb">{cr}</nav>
{body}
<a class="cta" href="/">{u['open']}</a>
</main>
<footer class="w ft">© <span>{datetime.date.today().year}</span> {BRAND}. {u['rights']}</footer>
</body>
</html>
"""


QUIZ_LINK = {}          # empreinte (md5) du cours -> URL de sa page de quiz


def file_li(it, lang, content=None):
    attr = f' lang="{content}" dir="{"rtl" if content == "ar" else "ltr"}"' if content and content != lang else ""
    mime = getattr(it, "mime", "application/pdf")
    tattr = f' type="{mime}"' if mime else ""
    meta = getattr(it, "meta", None) or f'{it.name.rsplit(".", 1)[-1].upper()} · {human_size(it.size, lang)}'
    q = QUIZ_LINK.get(getattr(it, "digest", None))
    ql = f'<a class="ql" href="{e(q)}">{UI[lang]["qlink"]}</a>' if q else ""
    return f'<li><a href="{e(it.url)}"{tattr}{attr}>{e(it.title)}</a>{ql}<span class="meta">{meta}</span></li>'


def render_list(page):
    items = sorted(page.items, key=lambda i: (i.order, natural_key(i.name)))
    has_groups = any(i.group for i in items)
    if not has_groups:
        return '<ul class="list">' + "".join(file_li(i, page.ui, page.lang) for i in items) + "</ul>"
    out, seen = [], []
    for i in items:
        g = i.group or ""
        if g not in seen:
            seen.append(g)
    for g in seen:
        sub = [i for i in items if (i.group or "") == g]
        if g:
            out.append(f"<h2>{e(g)}</h2>")
        out.append('<ul class="list">' + "".join(file_li(i, page.ui, page.lang) for i in sub) + "</ul>")
    return "\n".join(out)


def render_exam_table(page):
    u = UI[page.ui]
    cell = defaultdict(dict)       # year -> {(session, kind): Item}
    extra = []
    for it in sorted(page.items, key=lambda i: (bool(re.search(r"\(\d+\)", i.name)), natural_key(i.name))):
        if not it.exam:
            extra.append(it)
            continue
        y, s, k = it.exam
        cell[y].setdefault((s, k), it)
    rows = []
    for y in sorted(cell, reverse=True):
        tds = [f"<td>{y}</td>"]
        for key, lab in ((("normale", "sujet"), "sujet"), (("normale", "corrige"), "corr"),
                         (("rattrapage", "sujet"), "sujet"), (("rattrapage", "corrige"), "corr")):
            it = cell[y].get(key)
            tds.append(f'<td><a href="{e(it.url)}" type="application/pdf">{u[lab]} {y}</a></td>' if it else "<td>—</td>")
        rows.append("<tr>" + "".join(tds) + "</tr>")
    table = (f'<div class="tw"><table><thead><tr><th>{u["year"]}</th><th>{u["n_sujet"]}</th><th>{u["n_corr"]}</th>'
             f'<th>{u["r_sujet"]}</th><th>{u["r_corr"]}</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>")
    if extra:
        table += '<ul class="list" style="margin-top:1rem">' + "".join(file_li(i, page.ui, page.lang) for i in extra) + "</ul>"
    return table


def jsonld_for(page, pages_by_url):
    crumbs = [
        {"@type": "ListItem", "position": 1, "name": BRAND, "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": UI[page.ui]["hub"], "item": f"{SITE}/{OUT}/"},
        {"@type": "ListItem", "position": 3, "name": page.h1, "item": page.url},
    ]
    parts = []
    for it in sorted(page.items, key=lambda i: (i.order, natural_key(i.name))):
        parts.append({
            "@type": "LearningResource",
            "name": it.title if not it.exam else f"{TYPE_LABEL[page.ui]['examens']} {page.label} {it.exam[0]} {it.exam[1]} {it.exam[2]}",
            "url": SITE + it.url,
            "encodingFormat": "application/pdf" if it.name.lower().endswith(".pdf") else None,
            "inLanguage": page.lang,
            "learningResourceType": {"cours": "Lesson", "exercices": "Exercise", "fiches": "Study guide",
                                     "examens": "Exam", "resumes": "Study guide", "quiz": "Quiz"}[page.type],
            "isAccessibleForFree": True,
        })
        parts[-1] = {k: v for k, v in parts[-1].items() if v is not None}
    return [
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumbs},
        {"@context": "https://schema.org", "@type": "CollectionPage", "name": page.h1, "description": page.desc,
         "url": page.url, "inLanguage": page.ui, "isPartOf": {"@type": "WebSite", "name": BRAND, "url": SITE + "/"},
         "hasPart": parts},
    ]


def render_page(page, all_pages):
    u = UI[page.ui]
    related = [p for p in all_pages if p.ui == page.ui and p is not page]
    # même filière d'abord
    related.sort(key=lambda p: (p.scope != page.scope, TYPE_ORDER.index(p.type), p.scope))
    rel_html = ""
    if related:
        lis = "".join(f'<li><a href="{e(p.path)}">{e(p.h1)}</a></li>' for p in related[:8])
        rel_html = f'<section class="rel"><h2>{u["related"]}</h2><ul>{lis}</ul></section>'
    body = f"<h1>{e(page.h1)}</h1>\n<p class=\"intro\">{e(page.intro)}</p>\n"
    body += render_exam_table(page) if page.type == "examens" else render_list(page)
    body += rel_html
    other = page.alternates.get("ar" if page.ui == "fr" else "fr")
    crumbs = [(BRAND, "/"), (u["hub"], f"/{OUT}/"), (page.label if page.ui == "fr" else page.label_long, None)]
    return head(page.title, page.desc, page.url, page.ui, page.alternates,
                jsonld=jsonld_for(page, None)) + shell(page.ui, crumbs, body, other)


def render_hub(pages):
    title = f"Cours, exercices et examens nationaux de SVT (TC, 1BAC, 2BAC) | {BRAND}"
    desc = ("Cours, exercices et examens nationaux de SVT pour TC, 1BAC et 2BAC : PDF gratuits. "
            "دروس وتمارين وامتحانات علوم الحياة والأرض.")
    body = "<h1>Cours, exercices et examens nationaux de SVT</h1>\n"
    body += ('<p class="intro">Toutes les ressources de SVT organisées par niveau, en PDF et gratuites. '
             'دروس وتمارين وامتحانات وطنية في علوم الحياة والأرض.</p>')
    for lang in ("fr", "ar"):
        sub = [p for p in pages if p.ui == lang]
        if not sub:
            continue
        body += f'<h2>{"Français" if lang == "fr" else "العربية"}</h2><ul class="list" style="margin-bottom:.5rem">'
        for t in TYPE_ORDER:
            for p in sorted([p for p in sub if p.type == t], key=lambda p: p.scope):
                body += (f'<li><a href="{e(p.path)}" hreflang="{lang}">{e(p.h1)}</a>'
                         f'<span class="meta">{len(p.items)} {UI[lang]["files"]}</span></li>')
        body += "</ul>"
    crumbs = [(BRAND, "/"), ("Cours et examens", None)]
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": f"{SITE}/{OUT}/",
           "inLanguage": ["fr", "ar"], "isPartOf": {"@type": "WebSite", "name": BRAND, "url": SITE + "/"}}]
    return head(title, desc, f"{SITE}/{OUT}/", "fr", jsonld=ld) + shell("fr", crumbs, body)


# --------------------------------------------------------------------------
# sitemap + index
# --------------------------------------------------------------------------
def build_sitemap(pages, home_date):
    urls = [(SITE + "/", home_date, "1.0", None), (f"{SITE}/{OUT}/", home_date, "0.9", None)]
    for p in pages:
        urls.append((p.url, p.lastmod, "0.8", p.alternates if len(p.alternates) > 1 else None))
    seen = set()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for loc, mod, prio, alts in urls:
        lines.append(f"  <url><loc>{xml_escape(loc)}</loc><lastmod>{mod}</lastmod><priority>{prio}</priority>")
        if alts:
            for lg, u in sorted(alts.items()):
                lines.append(f'    <xhtml:link rel="alternate" hreflang="{lg}" href="{xml_escape(u)}"/>')
        lines.append("  </url>")
        seen.add(loc)
    for p in pages:                                    # les PDF eux-mêmes
        for it in p.items:
            loc = SITE + it.url
            if loc in seen or not getattr(it, "indexable", True):
                continue
            seen.add(loc)
            lines.append(f"  <url><loc>{xml_escape(loc)}</loc><lastmod>{it.date}</lastmod><priority>0.6</priority></url>")
    lines.append("</urlset>\n")
    return "\n".join(lines)


SHORT_TYPE = {"ar": {"cours": "الدروس", "exercices": "التمارين", "fiches": "الجذاذات", "resumes": "الملخصات", "quiz": "اختبارات", "examens": "الامتحانات الوطنية"},
              "fr": {"cours": "Cours", "exercices": "Exercices", "fiches": "Fiches", "resumes": "Résumés", "quiz": "Quiz", "examens": "Examens nationaux"}}
ICON_TYPE = {"cours": "📚", "exercices": "✏️", "fiches": "📋", "resumes": "🗒️", "quiz": "🎯", "examens": "📝"}
TYPE_SUFFIX = {"quiz": ""}          # les autres boutons se terminent par « PDF »
# section de la page d'accueil (id) -> type de pages /svt/ qui lui correspond
SECTION_TYPES = {"cours": "cours", "exercices": "exercices", "examens": "examens", "fiches": "fiches", "resumes": "resumes", "quiz": "quiz"}
# types de pages ajoutés EN PLUS dans une section (vide : chaque section n'affiche que ses propres pages)
SECTION_EXTRA = {}
# sections qui reçoivent aussi le bouton vers le sommaire /svt/
SECTION_HUB = ("examens",)


def patch_index_html(src, pages):
    """Ajoute à index.html (dans le dépôt de travail du déploiement uniquement) : balises de partage,
    JSON-LD, entrée de menu vers /svt/ et boutons « examens ». Idempotent ; ignore ce qu'il ne trouve pas."""
    pages = [p for p in pages if not p.is_twin]
    # 1) balises de partage (image 1200x630)
    old_og = '<meta property="og:image" content="https://gosvtmaroc.com/android-chrome-512x512.png">'
    if old_og in src:
        src = src.replace(old_og, (
            f'<meta property="og:image" content="{SITE}/og-image.png">\n'
            '    <meta property="og:image:width" content="1200">\n    <meta property="og:image:height" content="630">\n'
            '    <meta property="og:image:alt" content="Go SVT Maroc - Cours, exercices et examens nationaux de SVT">\n'
            '    <meta property="og:locale" content="fr_FR">\n    <meta property="og:locale:alternate" content="ar_MA">'))
    old_tw = '<meta name="twitter:card" content="summary">'
    if old_tw in src:
        src = src.replace(old_tw, (
            '<meta name="twitter:card" content="summary_large_image">\n'
            '    <meta name="twitter:title" content="Go SVT Maroc - Laboratoire des SVT">\n'
            '    <meta name="twitter:description" content="Cours, exercices et examens nationaux de SVT - دروس وتمارين وامتحانات علوم الحياة والأرض">\n'
            f'    <meta name="twitter:image" content="{SITE}/og-image.png">'))
    if 'application/ld+json' not in src and "</head>" in src:
        ld = {"@context": "https://schema.org", "@type": "WebSite", "name": BRAND, "alternateName": "Laboratoire des SVT",
              "url": SITE + "/", "inLanguage": ["fr", "ar"],
              "description": "Cours, exercices, fiches et examens nationaux de SVT (TC, 1BAC, 2BAC) en français et en arabe."}
        src = src.replace("</head>", '    <script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>\n</head>", 1)
    if 'name="robots"' not in src and "</head>" in src:
        src = src.replace("</head>", '    <meta name="robots" content="index,follow,max-image-preview:large">\n</head>', 1)

    # 2) menu « المزيد » : entrée vers /svt/
    nav = '<ul class="nav-submenu">'
    n0 = src.find(nav)
    already = n0 != -1 and 'href="/svt/"' in src[n0:src.find("</ul>", n0)]      # uniquement dans le menu « المزيد »
    if n0 != -1 and not already:
        src = src.replace(nav, nav + '\n        <li><a href="/svt/" data-lang-ar="📚 الدروس والامتحانات PDF" '
                          'data-lang-fr="📚 Cours et examens PDF">📚 الدروس والامتحانات PDF</a></li>', 1)

    # 3) liens vers les pages /svt/ placés SOUS LE TITRE de chaque section de la page d'accueil
    #    (blocs entre marqueurs : remplacés à chaque exécution ; anciens blocs / copies manuelles nettoyés)
    src = re.sub(r"\s*<!-- SEO-EXAM:START -->.*?<!-- SEO-EXAM:END -->", "", src, flags=re.S)
    src = re.sub(r'\s*<div class="seo-exam-links".*?</div>', "", src, flags=re.S)
    for sec, ptype in SECTION_TYPES.items():
        s_m, e_m = f"<!-- SEO-SECTION:{sec}:START -->", f"<!-- SEO-SECTION:{sec}:END -->"
        src = re.sub(r"\s*" + re.escape(s_m) + r".*?" + re.escape(e_m), "", src, flags=re.S)
        sec_pages = sorted([p for p in pages if p.type == ptype], key=lambda p: (p.lang, p.scope))
        for extra in SECTION_EXTRA.get(sec, []):
            sec_pages += sorted([p for p in pages if p.type == extra], key=lambda p: (p.lang, p.scope))
        i = src.find(f'<section id="{sec}"')
        if not sec_pages or i == -1:
            continue
        nxt = src.find("<section", i + 10)
        limit = nxt if nxt != -1 else len(src)
        k = src.find("section-intro", i)
        pos = -1
        if k != -1 and k < limit:
            q = src.find("</p>", k)
            pos = q + 4 if q != -1 else -1
        if pos == -1:
            q = src.find("</h2>", i)
            pos = q + 5 if q != -1 and q < limit else -1
        if pos == -1:
            continue
        btns = []
        for p in sec_pages:
            sar, sfr = (" (بالعربية)", " (en arabe)") if p.lang == "ar" else ("", "")
            ar = f'{ICON_TYPE[p.type]} {SHORT_TYPE["ar"][p.type]} {p.info["fr"]}{sar}{TYPE_SUFFIX.get(p.type, " PDF")}'
            fr = f'{ICON_TYPE[p.type]} {SHORT_TYPE["fr"][p.type]} {p.info["fr"]}{sfr}{TYPE_SUFFIX.get(p.type, " PDF")}'
            btns.append(f'<a class="btn btn-primary" href="{e(p.path)}" data-lang-ar="{e(ar)}" data-lang-fr="{e(fr)}">{e(ar)}</a>')
        if sec in SECTION_HUB:
            btns.append(f'<a class="btn btn-secondary" style="border:2px solid var(--primary-color)" href="/{OUT}/" '
                        'data-lang-ar="📚 كل الدروس والامتحانات PDF" data-lang-fr="📚 Tous les cours et examens PDF">'
                        '📚 كل الدروس والامتحانات PDF</a>')
        block = ('\n                ' + s_m + '\n                <div class="seo-section-links" style="display:flex;flex-wrap:wrap;gap:.6rem;'
                 'justify-content:center;margin:0 0 1.2rem">\n                    ' + "\n                    ".join(btns)
                 + "\n                </div>\n                " + e_m)
        src = src[:pos] + block + src[pos:]

    # 4) pied de page : (a) lien dans « Liens rapides » ; (b) nouvelle colonne dans la grille .footer-content
    f = src.find("<footer")
    if f != -1 and "gs-quick-svt" not in src:
        m = re.compile(r'<li><a href="#examens"[^>]*>[^<]*</a></li>').search(src, f)
        if m:
            li = ('\n                        <li class="gs-quick-svt"><a href="/svt/" data-lang-ar="📚 الدروس والامتحانات PDF" '
                  'data-lang-fr="📚 Cours et examens PDF">📚 الدروس والامتحانات PDF</a></li>')
            src = src[:m.end()] + li + src[m.end():]
    start, end = "<!-- SEO-LINKS:START -->", "<!-- SEO-LINKS:END -->"
    # on retire l'ancien bloc ET les espaces qui le précèdent : le retrait redonne exactement le texte d'origine
    src = re.sub(r"\s*" + re.escape(start) + r".*?" + re.escape(end), "", src, flags=re.S)
    marks = "\n                " + start + "\n                " + end
    f = src.find("<footer")
    k = src.find('data-goto-level="2BAC"', f) if f != -1 else -1
    pos = -1
    if k != -1:
        u = src.find("</ul>", k)
        d = src.find("</div>", u) if u != -1 else -1
        if d != -1:
            pos = d + 6
    if pos == -1:
        anchor = src.find('<button type="button" class="gs-share-site"')
        if anchor != -1:
            pos = len(src[:anchor].rstrip())
    if pos != -1:
        src = src[:pos] + marks + src[pos:]
    return src


def inject_index_links(pages):
    pages = [p for p in pages if not p.is_twin]
    idx = ROOT / "index.html"
    if not idx.exists():
        return False
    original = idx.read_text(encoding="utf-8")
    src = patch_index_html(original, pages)
    start, end = "<!-- SEO-LINKS:START -->", "<!-- SEO-LINKS:END -->"
    if start not in src or end not in src:
        print("   ! index.html : emplacement des liens de pied de page introuvable, bloc non injecté", file=sys.stderr)
        if src != original:
            idx.write_text(src, encoding="utf-8")
        return False
    li = [f'<li><a href="/{OUT}/" data-lang-ar="📚 كل الدروس والامتحانات" data-lang-fr="📚 Tous les cours et examens">📚 كل الدروس والامتحانات</a></li>']
    for t in TYPE_ORDER:
        for p in sorted([p for p in pages if p.type == t], key=lambda p: (p.lang, p.scope)):
            sar, sfr = (" (بالعربية)", " (en arabe)") if p.lang == "ar" else ("", "")
            ar = f'{SHORT_TYPE["ar"][t]} {p.info["fr"]}{sar}'
            fr = f'{SHORT_TYPE["fr"][t]} {p.info["fr"]}{sfr}'
            li.append(f'<li><a href="{e(p.path)}" data-lang-ar="{e(ar)}" data-lang-fr="{e(fr)}">{e(ar)}</a></li>')
    block = ('\n                <nav class="footer-section gs-seo-links" aria-label="Cours et examens SVT">'
             '<h3 data-lang-ar="📚 ملفات PDF" data-lang-fr="📚 Fichiers PDF">📚 ملفات PDF</h3>'
             "<ul>" + "".join(li) + "</ul></nav>\n                ")
    new = re.sub(re.escape(start) + r".*?" + re.escape(end), lambda m: start + block + end, src, flags=re.S)
    if new != original:
        idx.write_text(new, encoding="utf-8")
    return True


# --------------------------------------------------------------------------

# ------------------------------------------------------------------------------------------------------------------
# Pages de quiz : une page HTML par fichier quiz/**/*.json (questions, choix, bonne réponse et explication en TEXTE,
# donc lisibles et indexables). Les quiz « auto » (générés par IA) peuvent être mis en noindex tant qu'ils ne sont pas relus :
# variable QUIZ_PAGES_NOINDEX_AUTO=1.
# ------------------------------------------------------------------------------------------------------------------
NOINDEX_AUTO_QUIZ = os.environ.get("QUIZ_PAGES_NOINDEX_AUTO", "").strip().lower() in ("1", "true", "oui", "yes")


class QuizEntry:
    pass


def nfc(x):
    return unicodedata.normalize("NFC", str(x)).strip()


def scan_quizzes(titles):
    entries, groups = [], defaultdict(list)
    qdir = ROOT / "quiz"
    if not qdir.is_dir():
        return entries, groups
    for p in sorted(qdir.rglob("*.json")):
        rel = p.relative_to(ROOT).parts
        if len(rel) < 4 or rel[1] not in SUBJECTS:
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        qs = []
        for q in data.get("questions") or []:
            if not isinstance(q, dict):
                continue
            choix, rep = q.get("choix"), q.get("reponse")
            if (isinstance(q.get("question"), str) and q["question"].strip() and isinstance(choix, list) and 2 <= len(choix) <= 8
                    and all(isinstance(c, str) and c.strip() for c in choix) and isinstance(rep, int) and 1 <= rep <= len(choix)):
                qs.append({"question": q["question"].strip(), "choix": [c.strip() for c in choix], "reponse": rep,
                           "explication": str(q.get("explication") or "").strip()})
        if not qs:
            continue
        qe = QuizEntry()
        qe.lang = SUBJECTS[rel[1]]
        qe.scope = rel[3] if len(rel) >= 5 else rel[2]
        qe.info = scope_info(qe.scope)
        qe.slug = re.sub(r"[^\w\-]+", "-", p.stem.lower(), flags=re.UNICODE).strip("-") or "quiz"
        qe.url = f"/{OUT}/quiz/{qe.lang}/{qe.info['slug']}/{qe.slug}/"
        qe.title = str(data.get("titre") or p.stem).strip()
        qe.group = str(data.get("description") or "").strip()
        qe.questions = qs
        qe.auto = data.get("auto") is True
        qe.noindex = qe.auto and NOINDEX_AUTO_QUIZ
        qe.source, qe.source_md5 = data.get("source"), data.get("source_md5")
        qe.lesson = None
        item = Item(p, list(rel), 0, md5(p))
        item.url, item.name, item.title = qe.url, qe.slug, qe.title
        item.meta, item.mime, item.indexable = f"{len(qs)} QCM", None, not qe.noindex
        ov = titles.get(Path(str(qe.source)).name) if qe.source else None
        if isinstance(ov, dict):
            item.group, item.order = ov.get("group"), ov.get("order", 999)
        qe.item = item
        entries.append(qe)
        groups[("quiz", qe.lang, qe.scope)].append(item)
    return entries, groups


def trim(text, n=158):
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[: n - 1].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"


def render_quiz_page(q, siblings):
    L, u = q.lang, UI[q.lang]
    label = q.info["ar"] if L == "ar" else q.info["fr"]
    label_long = q.info["ar"] if L == "ar" else q.info["fr_long"]
    n = len(q.questions)
    letters = "ABCDEFGH" if L == "fr" else "أبجدهوزح"
    if L == "fr":
        h1 = f"QCM de SVT {label} : {q.title}"
        title = f"QCM SVT {label} : {q.title} - {n} questions corrigées | {BRAND}"
        desc = trim(f"{n} QCM de SVT ({label_long}) sur « {q.title} », avec la bonne réponse et l'explication de chaque question. Gratuit.")
        intro = (f"{n} questions à choix multiples sur « {q.title} »" + (f" ({q.group})" if q.group else "")
                 + ". Cliquez sur « Voir la réponse » pour vérifier votre réponse et lire l'explication.")
    else:
        h1 = f"اختبار علوم الحياة والأرض {label_long} : {q.title}"
        title = f"{h1} - {n} أسئلة مصححة | {BRAND}"
        desc = trim(f"{n} أسئلة من متعدد حول «{q.title}» ({label_long}) مع الإجابة الصحيحة وشرح كل سؤال. مجاني.")
        intro = (f"{n} أسئلة من متعدد حول «{q.title}»" + (f" ({q.group})" if q.group else "")
                 + ". انقر على «عرض الإجابة» للتحقق من إجابتك وقراءة الشرح.")
    lis = []
    for i, qq in enumerate(q.questions, 1):
        ch = "".join(f"<li><b>{letters[min(j, len(letters) - 1)]})</b> {e(c)}</li>" for j, c in enumerate(qq["choix"]))
        k = qq["reponse"] - 1
        expl = f'<p>{u["q_explain"]} : {e(qq["explication"])}</p>' if qq["explication"] else ""
        lis.append(f'<li class="q" id="q{i}"><p class="qt">{i}. {e(qq["question"])}</p><ul class="ch">{ch}</ul>'
                   f'<details><summary>{u["q_answer"]}</summary>'
                   f'<p><strong>{u["q_correct"]} : {letters[min(k, len(letters) - 1)]}) {e(qq["choix"][k])}</strong></p>{expl}</details></li>')
    acts = f'<a class="cta" href="/#quiz">🎯 {u["q_cta"]}</a>'
    if q.lesson is not None:
        acts += f' <a href="{e(q.lesson.url)}" type="application/pdf">📄 {u["q_lesson"]}</a>'
    note = f'<p class="note">🤖 {u["q_auto"]} <a href="/#contact">{u["q_contact"]}</a></p>' if q.auto else ""
    related = ""
    if siblings:
        rl = "".join(f'<li><a href="{e(x.url)}">{e(x.title)}</a></li>' for x in siblings[:8])
        related = f'<section class="rel"><h2>{u["q_other"]}</h2><ul>{rl}</ul></section>'
    body = (f"<h1>{e(h1)}</h1>\n<p class=\"intro\">{e(intro)}</p>\n<p class=\"acts\">{acts}</p>\n{note}"
            f"<ol class=\"qs\">{''.join(lis)}</ol>\n{related}")
    list_url = f"/{OUT}/quiz/{q.lang}/{q.info['slug']}/"
    crumbs = [(BRAND, "/"), (u["hub"], f"/{OUT}/"), (label_long if L == "ar" else label, list_url), (q.title, None)]
    questions_ld = []
    for qq in q.questions:
        k = qq["reponse"] - 1
        d = {"@type": "Question", "eduQuestionType": "Multiple choice", "text": qq["question"],
             "suggestedAnswer": [{"@type": "Answer", "text": c} for j, c in enumerate(qq["choix"]) if j != k],
             "acceptedAnswer": {"@type": "Answer", "text": qq["choix"][k]}}
        if qq["explication"]:
            d["answerExplanation"] = {"@type": "Comment", "text": qq["explication"]}
        questions_ld.append(d)
    ld = [
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": BRAND, "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": u["hub"], "item": f"{SITE}/{OUT}/"},
            {"@type": "ListItem", "position": 3, "name": q.title, "item": SITE + q.url}]},
        {"@context": "https://schema.org", "@type": "Quiz", "name": q.title, "url": SITE + q.url, "inLanguage": L,
         "educationalLevel": label, "about": {"@type": "Thing", "name": "SVT"}, "isAccessibleForFree": True, "hasPart": questions_ld},
    ]
    robots = "noindex,follow" if q.noindex else "index,follow,max-image-preview:large"
    return head(title, desc, SITE + q.url, L, None, robots=robots, jsonld=ld) + shell(L, crumbs, body, None)


def main():
    titles = load_titles()
    groups = scan(titles)
    qentries, qgroups = scan_quizzes(titles)
    for k, v in qgroups.items():
        groups[k].extend(v)

    pages, skipped = [], []
    for (ptype, lang, scope), items in sorted(groups.items()):
        items = dedupe(items)
        if len(items) < (1 if ptype == "quiz" else MIN_ITEMS):
            skipped.append((ptype, lang, scope, len(items)))
            continue
        pages.append(Page(ptype, lang, scope, items))

    # jumelle arabe de chaque page française : mêmes fichiers, texte (titre, description, intro) en arabe
    for p in list(pages):
        if p.lang == "fr":
            pages.append(Page(p.type, "fr", p.scope, p.items, ui="ar"))

    # hreflang : variantes d'un même contenu (même type, même filière, mêmes fichiers) -> {langue de la page : URL}
    by_key = defaultdict(dict)
    for p in pages:
        by_key[(p.type, p.scope, p.lang)][p.ui] = p.url
    for p in pages:
        p.alternates = dict(by_key[(p.type, p.scope, p.lang)])

    # lien cours <-> quiz (par empreinte du fichier ; sinon par chemin indiqué dans le quiz)
    file_items = [it for p in pages if p.type != "quiz" for it in p.items]
    by_digest = {it.digest: it for it in file_items}
    by_rel = {nfc("/".join(it.parts)): it for it in file_items}
    for qe in qentries:
        digest = qe.source_md5 or (by_rel[nfc(qe.source)].digest if qe.source and nfc(qe.source) in by_rel else None)
        qe.lesson = by_digest.get(digest) if digest else None
        if digest:
            QUIZ_LINK[digest] = qe.url

    # dates
    for p in pages:
        for it in p.items:
            it.date = git_date(it.path)
        p.lastmod = max(i.date for i in p.items)
    # date de modification de l'accueil = dernier vrai changement (jamais « aujourd'hui » par défaut : une date qui change à chaque
    # déploiement sans changement réel fait perdre sa crédibilité au sitemap)
    home_date = max([p.lastmod for p in pages] + [git_date(ROOT / "index.html")]) if pages else git_date(ROOT / "index.html")

    # écriture : on repart d'un dossier propre
    out_dir = ROOT / OUT
    if out_dir.exists():
        for f in sorted(out_dir.rglob("*"), reverse=True):
            f.unlink() if f.is_file() else f.rmdir()
    out_dir.mkdir(exist_ok=True)
    (out_dir / "index.html").write_text(render_hub(pages), encoding="utf-8")
    for p in pages:
        d = ROOT / p.path.strip("/")
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(render_page(p, pages), encoding="utf-8")

    by_group = defaultdict(list)
    for qe in qentries:
        by_group[(qe.lang, qe.scope)].append(qe)
    for qe in qentries:
        d = ROOT / qe.url.strip("/")
        d.mkdir(parents=True, exist_ok=True)
        sib = sorted([x for x in by_group[(qe.lang, qe.scope)] if x is not qe], key=lambda x: (x.item.order, natural_key(x.slug)))
        (d / "index.html").write_text(render_quiz_page(qe, sib), encoding="utf-8")

    (ROOT / "sitemap.xml").write_text(build_sitemap(pages, home_date), encoding="utf-8")
    linked = inject_index_links(pages)

    print(f"SEO : {len(pages)} pages générées dans /{OUT}/ (+ {len(qentries)} pages de quiz), sitemap.xml mis à jour, liens index.html : {'oui' if linked else 'non'}")
    for p in pages:
        print(f"   {p.path:<42} {len(p.items):>3} fichiers   {p.lastmod}")
    for t, lg, sc, n in skipped:
        print(f"   (ignoré : {t}/{lg}/{sc} - {n} fichier(s), minimum {MIN_ITEMS})")


if __name__ == "__main__":
    main()
