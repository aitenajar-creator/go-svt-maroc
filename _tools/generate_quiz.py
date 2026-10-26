#!/usr/bin/env python3
"""
Go SVT Maroc - génération automatique de quiz
=============================================
Pour chaque cours PDF (dossier cours/) qui n'a pas encore de quiz, envoie le PDF à
l'API Claude, récupère des questions à choix multiples (avec explication), les fait
relire par une 2e passe de vérification, puis écrit :

  quiz/<langue>/<niveau>/<filière>/<nom-du-cours>.json   (même format que vos quiz manuels)
  quiz-map.json                                          (cours -> quiz, pour le bouton "Exercices interactifs")

Règles de propriété d'un quiz :
  * "auto": true dans le JSON  -> fichier géré par le script (régénéré si le PDF change)
  * pas de "auto" (ou supprimé) -> fichier manuel : le script n'y touche JAMAIS
  * un quiz manuel qui indique "source": "cours/....pdf" empêche la génération pour ce cours

Variables d'environnement (toutes facultatives sauf la clé) :
  ANTHROPIC_API_KEY  clé API (secret GitHub). Absente -> le script ne fait rien.
  QUIZ_MODEL         défaut claude-sonnet-5-5
  QUIZ_MAX_NEW       nombre max de cours traités par exécution (défaut 5)
  QUIZ_VERIFY        1 = 2e passe de vérification (défaut), 0 = désactivée
  QUIZ_QUESTIONS     nombre cible de questions (défaut 10)
  QUIZ_FILTER        ne traiter que les cours dont le chemin contient ce texte
  QUIZ_FORCE         true = régénérer aussi les quiz "auto" déjà à jour
  QUIZ_SOURCES       dossiers sources séparés par des virgules (défaut "cours")
  QUIZ_MOCK          1 = aucune requête réseau, quiz factices (pour tester)

Le script ne fait JAMAIS échouer le déploiement : toute erreur est affichée en avertissement.
Usage local : python3 _tools/generate_quiz.py [--dry-run] [--strict]
"""
import base64
import datetime
import hashlib
import json
import os
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def env(name, default=""):
    v = (os.environ.get(name) or "").strip()
    return v if v else default


API_URL = env("ANTHROPIC_API_URL", "https://api.anthropic.com/v1/messages")
API_VERSION = "2023-06-01"
API_KEY = env("ANTHROPIC_API_KEY")
MODEL = env("QUIZ_MODEL", "claude-sonnet-5-5")
MAX_NEW = int(env("QUIZ_MAX_NEW", "5"))
VERIFY = env("QUIZ_VERIFY", "1").lower() not in ("0", "false", "non", "no")
TARGET = int(env("QUIZ_QUESTIONS", "10"))
FILTER = env("QUIZ_FILTER").lower()
FORCE = env("QUIZ_FORCE").lower() in ("1", "true", "oui", "yes")
SOURCES = [s.strip() for s in env("QUIZ_SOURCES", "cours").split(",") if s.strip()]
MOCK = env("QUIZ_MOCK").lower() in ("1", "true")
RETRY_DELAY = int(env("QUIZ_RETRY_DELAY", "20"))
TIMEOUT = 900
MAX_TOKENS = 16000
MIN_PUBLISH = 5          # en dessous, on ne publie pas
MAX_QUESTIONS = 15
MAX_PDF_BYTES = 22 * 1024 * 1024   # base64 gonfle de ~33 % ; limite API : 32 Mo par requête

SUBJECTS = {"francais": "fr", "arabe": "ar"}
LEVEL_NAMES = {"TC": "Tronc Commun", "1BAC": "1ère année du Baccalauréat", "2BAC": "2ème année du Baccalauréat"}
BRANCH_NAMES = {
    "TCS": "Tronc Commun Scientifique", "TCL": "Tronc Commun Lettres",
    "1BACSE": "Sciences Expérimentales", "1BACSM": "Sciences Mathématiques", "1BACL": "Lettres",
    "2BACSVT": "Sciences de la Vie et de la Terre (SVT)", "2BACSM": "Sciences Mathématiques",
    "2BACSP": "Sciences Physiques",
}
# $ par million de jetons (entrée, sortie) - estimation affichée dans les logs uniquement
PRICES = {"claude-sonnet-5-5": (2, 10), "claude-opus-5-5": (4, 20), "claude-haiku-5-5": (0.10, 0.50),
          "claude-fable-5-1": (10, 50)}


class Fatal(Exception):
    """Erreur qui rend inutile de continuer (clé refusée, modèle inconnu...)."""


class Skip(Exception):
    """Erreur limitée au cours en cours de traitement."""


# --------------------------------------------------------------------------
# Outils
# --------------------------------------------------------------------------
def nfc(s):
    return unicodedata.normalize("NFC", str(s)).strip()


def md5_file(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def slugify(name):
    s = nfc(re.sub(r"\.[^.]+$", "", name)).lower()
    s = re.sub(r"[^\w]+", "-", s, flags=re.UNICODE).strip("-_")
    return (s or "quiz")[:90]


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return None


def write_json(path, obj):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def warn(msg):
    print(f"::warning::{msg}" if os.environ.get("GITHUB_ACTIONS") else f"   ! {msg}")


def load_titles():
    data = read_json(ROOT / "_tools" / "seo-titles.json") or {}
    return {k: v for k, v in data.items() if not k.startswith("_")}


# --------------------------------------------------------------------------
# Inventaire des cours
# --------------------------------------------------------------------------
class Lesson:
    def __init__(self, digest, rep, aliases):
        self.digest = digest
        self.rep = rep                  # Path représentatif
        self.aliases = aliases          # tous les chemins relatifs (str, NFC) ayant ce contenu
        parts = rep.relative_to(ROOT).parts
        self.parts = parts
        self.subject = parts[1]
        self.level = parts[2]
        self.branch = parts[3] if len(parts) >= 5 else None
        self.lang = SUBJECTS[self.subject]
        self.rel = nfc("/".join(parts))
        qdir = ["quiz", self.subject, self.level] + ([self.branch] if self.branch else [])
        self.quiz_rel = "/".join(qdir + [slugify(parts[-1]) + ".json"])
        self.quiz_path = ROOT / self.quiz_rel


def scan_lessons():
    by_digest = {}
    for src in SOURCES:
        base = ROOT / src
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            if not p.is_file() or p.suffix.lower() != ".pdf" or p.name.startswith("."):
                continue
            parts = p.relative_to(ROOT).parts
            if len(parts) < 4 or parts[1] not in SUBJECTS:
                continue
            if p.stat().st_size < 2048:
                continue
            by_digest.setdefault(md5_file(p), []).append(p)
    lessons = []
    for digest, paths in by_digest.items():
        paths.sort(key=lambda p: (bool(re.search(r"\(\d+\)", p.name)), len(p.parts), p.name))
        aliases = [nfc("/".join(p.relative_to(ROOT).parts)) for p in paths]
        lessons.append(Lesson(digest, paths[0], aliases))
    lessons.sort(key=lambda l: l.rel)
    return lessons


def existing_quizzes():
    out = {}
    qdir = ROOT / "quiz"
    if qdir.is_dir():
        for p in sorted(qdir.rglob("*.json")):
            data = read_json(p)
            if isinstance(data, dict):
                out["/".join(p.relative_to(ROOT).parts)] = data
    return out


# --------------------------------------------------------------------------
# API Claude
# --------------------------------------------------------------------------
USAGE = {"in": 0, "out": 0}


def api_call(body):
    data = json.dumps(body).encode("utf-8")
    headers = {"content-type": "application/json", "x-api-key": API_KEY, "anthropic-version": API_VERSION}
    for attempt in range(1, 5):
        req = urllib.request.Request(API_URL, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                resp = json.loads(r.read().decode("utf-8"))
            u = resp.get("usage") or {}
            USAGE["in"] += int(u.get("input_tokens") or 0)
            USAGE["out"] += int(u.get("output_tokens") or 0)
            return resp
        except urllib.error.HTTPError as e:
            txt = e.read().decode("utf-8", "replace")[:600]
            if e.code in (401, 403):
                raise Fatal(f"clé API refusée (HTTP {e.code}) : {txt}")
            if e.code == 404:
                raise Fatal(f"modèle ou adresse introuvable (HTTP 404, modèle « {MODEL} ») : {txt}")
            if e.code in (408, 409, 429, 500, 502, 503, 504, 529) and attempt < 4:
                wait = RETRY_DELAY * attempt
                print(f"     ... HTTP {e.code}, nouvelle tentative dans {wait}s")
                time.sleep(wait)
                continue
            raise Skip(f"erreur API HTTP {e.code} : {txt}")
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            if attempt < 4:
                time.sleep(RETRY_DELAY * attempt)
                continue
            raise Skip(f"erreur réseau : {e}")
    raise Skip("échec après plusieurs tentatives")


def tool_input(resp, tool_name):
    if resp.get("stop_reason") == "max_tokens":
        raise Skip("réponse tronquée (max_tokens atteint)")
    blocks = resp.get("content") or []
    for b in blocks:
        if b.get("type") == "tool_use" and b.get("name") == tool_name and isinstance(b.get("input"), dict):
            return b["input"]
    text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    m = re.search(r"\{.*\}", text, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    raise Skip("la réponse ne contient pas de quiz exploitable")


QUIZ_TOOL = {
    "name": "enregistrer_quiz",
    "description": "Enregistre le quiz final rédigé à partir du cours.",
    "input_schema": {
        "type": "object",
        "properties": {
            "titre": {"type": "string", "description": "Titre du chapitre tel qu'il figure dans le cours"},
            "description": {"type": "string", "description": "Unité / thème, en quelques mots"},
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "choix": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
                        "reponse": {"type": "integer", "description": "Numéro (à partir de 1) de la bonne réponse"},
                        "explication": {"type": "string"},
                    },
                    "required": ["question", "choix", "reponse", "explication"],
                },
            },
        },
        "required": ["titre", "questions"],
    },
}

VERIFY_TOOL = {
    "name": "verifier_quiz",
    "description": "Enregistre le verdict de vérification pour chaque question.",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdicts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "numero": {"type": "integer"},
                        "statut": {"type": "string", "enum": ["ok", "douteux", "faux"]},
                        "raison": {"type": "string"},
                    },
                    "required": ["numero", "statut"],
                },
            }
        },
        "required": ["verdicts"],
    },
}

SYSTEM_QUIZ = """Tu es un professeur de SVT (Sciences de la Vie et de la Terre) expérimenté au Maroc, spécialiste de la préparation au Baccalauréat. Tu rédiges des quiz de révision à choix multiples à partir d'un cours fourni en PDF (texte, schémas, documents, tableaux).

Règles impératives :
1. Base-toi UNIQUEMENT sur le contenu du cours fourni. N'invente aucun fait, ne complète pas avec des connaissances extérieures, ne pose aucune question dont la réponse ne figure pas dans le document.
2. Chaque question a UNE seule bonne réponse, sans ambiguïté, vérifiable dans le cours. Les mauvaises réponses (distracteurs) sont plausibles mais clairement fausses d'après le cours.
3. Reprends le vocabulaire, les notations, les unités et les abréviations exactement comme dans le cours.
4. Varie les types de questions : définitions, mécanismes et étapes, localisation (où / quand), relations de cause à effet, comparaisons, interprétation de schémas ou de documents du cours (décris le document dans la question pour qu'elle reste compréhensible sans le voir), applications.
5. Chaque question doit être compréhensible seule : ne fais jamais référence à « la page 3 », « le texte ci-dessus » ou « le document » sans le décrire.
6. N'utilise jamais « toutes les réponses », « aucune de ces réponses » ni « A et B ».
7. Donne 4 choix par question, de longueur comparable, sans indice grammatical qui trahisse la bonne réponse.
8. L'explication (1 à 3 phrases) justifie la bonne réponse avec les notions du cours.
9. Si le document contient peu de contenu pédagogique (page de garde, simple série d'exercices), produis moins de questions plutôt que d'en inventer."""

SYSTEM_VERIFY = """Tu es un correcteur de SVT très rigoureux. On te donne un cours (PDF) et un quiz rédigé à partir de ce cours. Pour CHAQUE question, vérifie dans le cours que :
(a) la réponse indiquée comme correcte est bien correcte d'après le cours ;
(b) aucun autre choix n'est également correct ;
(c) l'explication est exacte et cohérente avec la réponse ;
(d) la question est claire, sans ambiguïté, et compréhensible sans le document.
Réponds « ok » uniquement si tu en es certain ; « douteux » au moindre doute ; « faux » si la réponse indiquée est incorrecte. Précise brièvement la raison pour tout statut autre que « ok »."""


def pdf_block(path):
    data = Path(path).read_bytes()
    if len(data) > MAX_PDF_BYTES:
        raise Skip(f"PDF trop lourd ({len(data) // 1048576} Mo, maximum {MAX_PDF_BYTES // 1048576} Mo)")
    n_pages = len(re.findall(rb"/Type\s*/Page(?![s\w])", data))
    if n_pages > 100:
        raise Skip(f"PDF trop long ({n_pages} pages, maximum 100) : découpez-le en chapitres")
    return {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                           "data": base64.standard_b64encode(data).decode("ascii")}}


def lesson_context(lesson, info):
    level = LEVEL_NAMES.get(lesson.level, lesson.level)
    branch = BRANCH_NAMES.get(lesson.branch or "", lesson.branch or "")
    lines = [f"Niveau : {level}" + (f" - filière : {branch}" if branch else "")]
    if info.get("title"):
        lines.append(f"Chapitre : {info['title']}")
    if info.get("group"):
        lines.append(f"Unité : {info['group']}")
    return "\n".join(lines)


def ask_for_quiz(lesson, info, block):
    lang = ("français" if lesson.lang == "fr" else
            "arabe standard (العربية الفصحى) ; garde les termes scientifiques exactement comme dans le cours")
    lo, hi = max(6, TARGET - 2), TARGET + 2
    prompt = (f"{lesson_context(lesson, info)}\nLangue de TOUT le texte du quiz (titre, questions, choix, explications) : {lang}.\n\n"
              f"Rédige entre {lo} et {hi} questions couvrant l'ensemble du cours de façon équilibrée "
              f"(le nombre dépend de la richesse du cours). Utilise l'outil enregistrer_quiz pour fournir le résultat ; "
              f"le champ « reponse » est le numéro, à partir de 1, de la bonne réponse.")
    body = {"model": MODEL, "max_tokens": MAX_TOKENS, "system": SYSTEM_QUIZ, "tools": [QUIZ_TOOL],
            "messages": [{"role": "user", "content": [block, {"type": "text", "text": prompt}]}]}
    return tool_input(api_call(body), QUIZ_TOOL["name"])


def ask_to_verify(lesson, questions, block):
    letters = "ABCDEFGH"
    lines = []
    for i, q in enumerate(questions, 1):
        lines.append(f"Question {i} : {q['question']}")
        for j, c in enumerate(q["choix"]):
            lines.append(f"   {letters[j]}) {c}")
        lines.append(f"   Réponse indiquée : {letters[q['reponse'] - 1]}")
        lines.append(f"   Explication : {q['explication']}\n")
    prompt = ("Voici le quiz à vérifier :\n\n" + "\n".join(lines) +
              "\nUtilise l'outil verifier_quiz : un verdict par question (numero = numéro de la question).")
    body = {"model": MODEL, "max_tokens": MAX_TOKENS, "system": SYSTEM_VERIFY, "tools": [VERIFY_TOOL],
            "messages": [{"role": "user", "content": [block, {"type": "text", "text": prompt}]}]}
    out = tool_input(api_call(body), VERIFY_TOOL["name"])
    verdicts = out.get("verdicts")
    if isinstance(verdicts, str):
        try:
            verdicts = json.loads(verdicts)
        except json.JSONDecodeError:
            verdicts = None
    if not isinstance(verdicts, list):
        raise Skip("vérification illisible")
    return {int(v.get("numero")): v for v in verdicts if isinstance(v, dict) and str(v.get("numero", "")).isdigit()}


# --------------------------------------------------------------------------
# Validation + mise en forme
# --------------------------------------------------------------------------
BAD_CHOICE = re.compile(
    r"(toutes?\s+les\s+(r[ée]ponses|propositions)|aucune\s+(de|des)\s+(ces|les)\s|"
    r"(r[ée]ponses|propositions)\s+[a-d]\s+et\s+[a-d]|all of the above|none of the above|"
    r"كل\s+ما\s+سبق|جميع\s+(ما\s+سبق|الإجابات|الاجابات)|لا\s+شيء\s+مما|لا\s+أحد\s+مما)", re.I)


def clean_questions(raw):
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return []
    out, seen = [], set()
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        q = nfc(item.get("question", ""))
        expl = nfc(item.get("explication", ""))
        choix = [nfc(c) for c in item.get("choix", [])] if isinstance(item.get("choix"), list) else []
        try:
            rep = int(item.get("reponse"))
        except (TypeError, ValueError):
            continue
        if not q or not expl or len(q) > 600 or not (3 <= len(choix) <= 5):
            continue
        if any((not c) or len(c) > 350 for c in choix) or not (1 <= rep <= len(choix)):
            continue
        if len({c.lower() for c in choix}) != len(choix) or any(BAD_CHOICE.search(c) for c in choix):
            continue
        if q.lower() in seen:
            continue
        seen.add(q.lower())
        out.append({"question": q, "choix": choix, "reponse": rep, "explication": expl})
    return out[:MAX_QUESTIONS]


def shuffle_choices(questions, digest):
    """Mélange les choix (déterministe) pour que la bonne réponse ne soit pas toujours à la même place."""
    out = []
    for q in questions:
        rng = random.Random(f"{digest}:{q['question']}")
        order = list(range(len(q["choix"])))
        rng.shuffle(order)
        out.append({"question": q["question"], "choix": [q["choix"][i] for i in order],
                    "reponse": order.index(q["reponse"] - 1) + 1, "explication": q["explication"]})
    return out


def mock_quiz(lesson):
    qs = []
    for i in range(1, 8):
        qs.append({"question": f"[TEST] Question {i} sur {lesson.parts[-1]} ?",
                   "choix": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
                   "reponse": (i % 4) + 1, "explication": f"[TEST] Explication de la question {i}."})
    return {"titre": f"[TEST] {lesson.parts[-1]}", "description": "Quiz factice", "questions": qs}


def build_quiz(lesson, info):
    if MOCK:
        raw, verified = mock_quiz(lesson), False
        questions = clean_questions(raw["questions"])
    else:
        block = pdf_block(lesson.rep)
        raw = ask_for_quiz(lesson, info, block)
        questions = clean_questions(raw.get("questions"))
        if len(questions) < MIN_PUBLISH:
            raise Skip(f"seulement {len(questions)} question(s) valide(s) (minimum {MIN_PUBLISH})")
        verified = False
        if VERIFY:
            verdicts = ask_to_verify(lesson, questions, block)
            kept = []
            for i, q in enumerate(questions, 1):
                v = verdicts.get(i)
                if v and v.get("statut") == "ok":
                    kept.append(q)
                else:
                    why = (v or {}).get("raison") or "non vérifiée"
                    print(f"     - question {i} retirée ({(v or {}).get('statut', '?')}) : {why[:140]}")
            questions, verified = kept, True
    if len(questions) < MIN_PUBLISH:
        raise Skip(f"seulement {len(questions)} question(s) fiable(s) après vérification (minimum {MIN_PUBLISH})")
    titre = info.get("title") or nfc(raw.get("titre", "")) or re.sub(r"\.[^.]+$", "", lesson.parts[-1])
    desc = info.get("group") or nfc(raw.get("description", ""))
    return {
        "titre": titre, "description": desc, "auto": True,
        "source": lesson.rel, "source_md5": lesson.digest, "modele": "test" if MOCK else MODEL,
        "verifie": verified, "genere_le": datetime.date.today().isoformat(),
        "questions": shuffle_choices(questions, lesson.digest),
    }


# --------------------------------------------------------------------------
# quiz-map.json
# --------------------------------------------------------------------------
def write_quiz_map(lessons):
    quizzes = existing_quizzes()
    by_digest, by_path = {}, {}
    for l in lessons:
        for a in l.aliases:
            by_path[a] = l
    quiz_of = {}                                  # digest -> chemin du quiz
    for qpath, data in quizzes.items():
        if data.get("auto") is True and data.get("source_md5"):
            quiz_of[data["source_md5"]] = qpath
        elif data.get("source") and nfc(data["source"]) in by_path:
            quiz_of[by_path[nfc(data["source"])].digest] = qpath
    mapping = {}
    for l in lessons:
        if l.digest in quiz_of:
            for a in l.aliases:
                mapping[a] = quiz_of[l.digest]
    mp = ROOT / "quiz-map.json"
    new = json.dumps(dict(sorted(mapping.items())), ensure_ascii=False, indent=2) + "\n"
    if not mp.exists() or mp.read_text(encoding="utf-8") != new:
        mp.write_text(new, encoding="utf-8")
    return len(mapping)


# --------------------------------------------------------------------------
def main():
    dry = "--dry-run" in sys.argv
    strict = "--strict" in sys.argv
    if not API_KEY and not MOCK and not dry:
        print("Quiz : ANTHROPIC_API_KEY absente - génération ignorée (voir _tools/README_QUIZ.md).")
        lessons = scan_lessons()
        write_quiz_map(lessons)
        return 0

    titles = load_titles()
    lessons = scan_lessons()
    quizzes = existing_quizzes()
    manual_sources = {nfc(d["source"]) for d in quizzes.values() if d.get("auto") is not True and d.get("source")}

    todo, uptodate, manual = [], 0, 0
    for l in lessons:
        if FILTER and FILTER not in l.rel.lower():
            continue
        existing = quizzes.get(l.quiz_rel)
        if any(a in manual_sources for a in l.aliases):
            manual += 1
        elif existing is not None and existing.get("auto") is not True:
            manual += 1
        elif existing is not None and existing.get("source_md5") == l.digest and not FORCE:
            uptodate += 1
        else:
            todo.append(l)

    print(f"Quiz : {len(lessons)} cours uniques | à jour : {uptodate} | manuels (ignorés) : {manual} | à générer : {len(todo)}"
          f" | modèle : {MODEL}{' | MOCK' if MOCK else ''} | vérification : {'oui' if VERIFY else 'non'}")
    batch = todo[:MAX_NEW]
    if len(todo) > len(batch):
        print(f"   (limite de {MAX_NEW} cours par exécution : {len(todo) - len(batch)} restant(s) pour la prochaine exécution)")

    done = failed = 0
    if not dry:
        for n, l in enumerate(batch, 1):
            info = titles.get(l.parts[-1]) or {}
            info = {"title": info} if isinstance(info, str) else info
            print(f"[{n}/{len(batch)}] {l.rel}")
            t0 = time.time()
            try:
                quiz = build_quiz(l, info)
                write_json(l.quiz_path, quiz)
                done += 1
                print(f"   ✓ {l.quiz_rel} : {len(quiz['questions'])} questions ({time.time() - t0:.0f}s)")
            except Skip as e:
                failed += 1
                warn(f"quiz non généré pour {l.rel} : {e}")
            except Fatal as e:
                failed += 1
                warn(f"arrêt de la génération : {e}")
                break
    else:
        for l in batch:
            print(f"   (dry-run) {l.rel}  ->  {l.quiz_rel}")

    mapped = write_quiz_map(lessons)
    p_in, p_out = PRICES.get(MODEL, (0, 0))
    cost = USAGE["in"] / 1e6 * p_in + USAGE["out"] / 1e6 * p_out
    if USAGE["in"] or USAGE["out"]:
        print(f"Quiz : {done} généré(s), {failed} échec(s) | jetons entrée {USAGE['in']:,} / sortie {USAGE['out']:,}"
              f" | coût estimé ≈ {cost:.2f} $ | {mapped} cours reliés à un quiz")
    else:
        print(f"Quiz : {done} généré(s), {failed} échec(s) | {mapped} cours reliés à un quiz")
    return 1 if (strict and failed) else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                        # ne jamais bloquer le déploiement
        warn(f"génération des quiz interrompue : {exc!r}")
        sys.exit(1 if "--strict" in sys.argv else 0)
