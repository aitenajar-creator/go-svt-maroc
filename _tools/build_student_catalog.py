#!/usr/bin/env python3
"""Build a factual, deduplicated catalog from the repository's existing learning files."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
TRACKS = {'TC': ['TCS','TCL'], '1BAC':['1BACSE','1BACSM','1BACL'], '2BAC':['2BACSVT','2BACSP','2BACSM']}
TRANSLATIONS = {
    ('TC','u1c1'):'الخرجة البيئية', ('TC','u1c2'):'العوامل الترابية وعلاقتها بالكائنات الحية',
    ('TC','u1c3'):'العوامل المناخية وعلاقتها بالكائنات الحية', ('TC','u1c4'):'تدفق المادة والطاقة في النظام البيئي', ('TC','u1c5'):'التوازنات الطبيعية',
    ('1BAC','u1c1'):'إنجاز خريطة الجغرافيا القديمة', ('1BAC','u1c2'):'استرداد التاريخ الجيولوجي لمنطقة رسوبية', ('1BAC','u1c3'):'الخريطة الجيولوجية والتاريخ الجيولوجي',
    ('1BAC','u2c1'):'امتصاص الماء والأملاح المعدنية عند النباتات', ('1BAC','u2c2'):'التبادلات الغازية اليخضورية', ('1BAC','u2c3'):'تحويل الطاقة الضوئية وتركيب المادة العضوية',
    ('1BAC','u3c1'):'التواصل الهرموني وتنظيم تحلون الدم', ('1BAC','u3c2'):'التواصل العصبي', ('1BAC','u4c1'):'تنظيم التوالد عند الإنسان'
}

def title(path, level, original):
    name = path.stem.lower()
    code = re.search(r'u\d+c\d+', name)
    if code and (level, code.group()) in TRANSLATIONS: return TRANSLATIONS[(level, code.group())]
    if 'consomation' in name or 'respiration-fermentation' in name: return 'التفاعلات المسؤولة عن تحرير الطاقة'
    if 'role de muscle' in name or 'role-de-muscle' in name: return 'دور العضلة الهيكلية في تحويل الطاقة'
    return original

def main():
    mapping = json.loads((ROOT/'quiz-map.json').read_text(encoding='utf-8'))
    items = []
    hashes = set()
    paths = [p for folder in ['cours','exercices','examens','fiches','resumes','quiz'] for p in (ROOT/folder).rglob('*') if p.suffix.lower() in ('.pdf','.json')]
    paths.sort(key=lambda p: (p.relative_to(ROOT).as_posix() not in mapping, len(p.parts), p.as_posix()))
    for path in paths:
        relative = path.relative_to(ROOT).as_posix()
        parts = relative.split('/')
        if len(parts)<4 or parts[2] not in TRACKS: continue
        kind, language, level = parts[:3]
        if language not in ('arabe','francais'): continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        # Identical copies of one course should not inflate learner progress.
        track = next((x.replace(' ','').upper() for x in parts[3:-1] if x.replace(' ','').upper() in TRACKS[level]),None)
        dedupe = (digest, kind, level, language, track)
        if dedupe in hashes: continue
        hashes.add(dedupe)
        if not track and level=='2BAC':
            if re.search(r'\bsm\b',path.stem,re.I): track='2BACSM'
            elif re.search(r'\bpc\b',path.stem,re.I): track='2BACSP'
        bank = json.loads(path.read_text(encoding='utf-8')) if kind=='quiz' else None
        linked = mapping.get(relative)
        linked_bank = json.loads((ROOT/linked).read_text(encoding='utf-8')) if linked and (ROOT/linked).is_file() else None
        original = (bank or linked_bank or {}).get('titre') or path.stem
        year = re.search(r'(?:19|20)\d{2}',path.stem)
        correction = bool(re.search(r'corrig|correction|تصحيح',relative,re.I))
        item = {'id':relative,'path':'/'+relative,'type':kind,'language':language,'level':level,'tracks':[track] if track else TRACKS[level],
                'title':title(path,level,original),'original_title':original,'bytes':path.stat().st_size,'source':'repository','sha256':digest}
        if bank and isinstance(bank.get('tracks'),list) and all(x in TRACKS[level] for x in bank['tracks']): item['tracks']=bank['tracks']
        if bank: item.update(questions=len(bank.get('questions',[])),duration_minutes=bank.get('duration_minutes',max(5,len(bank.get('questions',[]))*2)))
        order = re.search(r'u(\d+)c(\d+)',path.stem,re.I) or re.search(r'unit[eé]\s*(\d+).*?chap(?:itre)?\s*(\d+)',path.stem,re.I)
        if order: item['sequence']=int(order.group(1))*100+int(order.group(2))
        if linked: item['quiz_path']='/'+linked
        if kind=='examens': item.update(year=int(year.group()) if year else None,session='rattrapage' if 'rattrapage' in path.stem else ('normale' if 'normale' in path.stem else 'unknown'),exam_kind='correction' if correction else 'subject')
        items.append(item)
    corrections = {(x['level'],tuple(x['tracks']),x.get('year'),x.get('session')):x['path'] for x in items if x.get('exam_kind')=='correction'}
    for item in items:
        if item.get('exam_kind')=='subject' and item.get('year') and item.get('session')!='unknown': item['correction_path']=corrections.get((item['level'],tuple(item['tracks']),item.get('year'),item.get('session')))
    shared=ROOT/'assets/student-platform/scientific-skills.json'
    if shared.exists():
        bank=json.loads(shared.read_text(encoding='utf-8'))
        items.append({'id':'platform-scientific-skills','path':'/assets/student-platform/scientific-skills.json','type':'quiz','language':'arabe','scope':'shared-skill','title':bank['titre'],'original_title':bank['titre'],'source':'repository','questions':len(bank['questions']),'duration_minutes':10,'tracks':[]})
    items.sort(key=lambda x:(x.get('level',''),x['type'],x['path']))
    output=ROOT/'student-platform-catalog.json'
    output.write_text(json.dumps({'version':1,'source':'repository files; no synthetic progress or exam results','resources':items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Catalog: {len(items)} real resources; duplicates removed; shared skills explicitly labeled.')

if __name__=='__main__': main()
