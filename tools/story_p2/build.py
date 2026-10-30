# -*- coding: utf-8 -*-
"""story.json 에 2부 스토리·개인 이야기·speakers 를 합치고 records.json 을 쓴다."""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import SPEAKERS
import ch_intro_frost, ch_abyss_sky, ch_glass_paper, ch_library_part1, personal, records

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'data')
p = os.path.join(ROOT, 'story.json')
s = json.load(open(p, encoding='utf-8'))
for k, v in SPEAKERS.items():
    s['speakers'].setdefault(k, v)
n = 0
for mod in (ch_intro_frost, ch_abyss_sky, ch_glass_paper, ch_library_part1):
    for k, v in mod.SCENES.items():
        s['scenes'][k] = v; n += 1
for k, v in personal.P.items():
    s['scenes'][k] = v; n += 1
# 화자 검증
bad = set()
for k, sc in s['scenes'].items():
    for l in sc['lines']:
        if l['s'] not in s['speakers']: bad.add((k, l['s']))
if bad: print('unknown speakers', bad)
json.dump(s, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(records.RECORDS, open(os.path.join(ROOT, 'records.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
lines = sum(len(sc['lines']) for sc in s['scenes'].values())
print('scenes', len(s['scenes']), 'added', n, 'lines', lines, 'records', len(records.RECORDS))
