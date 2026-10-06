"""Helpers for commentary writers.  Run from anywhere:  python3 <path>/tools.py <command> ...

  example                              one finished section of commentary (Moby-Dick, ch. 36) to match in quality
  ids <book>                           section ids and titles known so far
  raw <book> <key> [start] [end]       numbered paragraphs of an unsectioned text (raw_<key>.json, or raw.json if key is '-')
  mksections <book> <key>              build chapters_<key>.json from raw + sections_<key>.json (run after writing sections)
  dump <book> <id> [<id> ...]          numbered paragraphs of finished sections
  verify <book> <commentary file> [--allow id,id]   check quotes are verbatim and link targets exist
"""
import json, sys, os, re, glob
R = os.path.dirname(os.path.abspath(__file__))

def chapters(book):
    out = []
    f = f'{R}/{book}/chapters.json'
    if os.path.exists(f): out += json.load(open(f))
    for g in sorted(glob.glob(f'{R}/{book}/chapters_*.json')): out += json.load(open(g))
    return out

def rawfile(book, key): return f'{R}/{book}/raw.json' if key == '-' else f'{R}/{book}/raw_{key}.json'

def show(p): return p.replace('\n', '\n      ')

cmd = sys.argv[1] if len(sys.argv) > 1 else ''
if cmd == 'example':
    cm = json.load(open(f'{R}/../build/commentary_3.json'))['ch36']
    print('=== ESSAY (a strong chapter, so it runs long) ===\n' + cm['essay'])
    print('\n=== FIVE OF ITS NOTES ===')
    for a in cm['annotations'][:5]: print(f"QUOTE: {a['quote']}\nNOTE:  {a['note']}\n")
    print('=== LINKS ===\n' + json.dumps(cm.get('links', []), ensure_ascii=False, indent=1))
elif cmd == 'ids':
    for c in chapters(sys.argv[2]): print(c['id'], '—', c.get('kicker', ''), '—', c.get('title', ''))
elif cmd == 'raw':
    ps = json.load(open(rawfile(sys.argv[2], sys.argv[3])))
    a = int(sys.argv[4]) if len(sys.argv) > 4 else 0; b = int(sys.argv[5]) if len(sys.argv) > 5 else len(ps)
    print(f'{len(ps)} paragraphs, {sum(len(p.split()) for p in ps)} words')
    for i in range(a, min(b, len(ps))): print(f'[{i}] {show(ps[i])}')
elif cmd == 'mksections':
    book, key = sys.argv[2], sys.argv[3]
    ps = json.load(open(rawfile(book, key)))
    secs = json.load(open(f'{R}/{book}/sections_{key}.json' if key != '-' else f'{R}/{book}/sections.json'))
    assert secs[0]['start'] == 0, 'first section must start at paragraph 0'
    starts = [s['start'] for s in secs]
    assert starts == sorted(set(starts)), 'starts must be strictly increasing'
    assert starts[-1] < len(ps), 'start beyond end of text'
    out = []
    for i, s in enumerate(secs):
        e = secs[i + 1]['start'] if i + 1 < len(secs) else len(ps)
        assert re.fullmatch(r'[a-z0-9]+', s['id']), 'ids are lowercase letters and digits only'
        c = dict(id=s['id'], num=None, title=s['title'], paras=ps[s['start']:e])
        for k in ('kind', 'kicker', 'ref'):
            if s.get(k): c[k] = s[k]
        out.append(c)
        print(f"{s['id']:6} {sum(len(p.split()) for p in c['paras']):6} words  {s.get('kind','')}  {s['title']}")
    json.dump(out, open(f'{R}/{book}/chapters_{key}.json' if key != '-' else f'{R}/{book}/chapters.json', 'w'), ensure_ascii=False)
elif cmd == 'dump':
    want = sys.argv[3:]
    for c in chapters(sys.argv[2]):
        if c['id'] in want:
            print(f"\n===== {c['id']} | {c.get('kicker','')} | {c.get('title','')} =====")
            for i, p in enumerate(c['paras']): print(f'[{i}] {show(p)}')
elif cmd == 'verify':
    book, f = sys.argv[2], sys.argv[3]
    allow = set(sys.argv[sys.argv.index('--allow') + 1].split(',')) if '--allow' in sys.argv else set()
    chs = {c['id']: c for c in chapters(book)}
    data = json.load(open(f if os.path.isabs(f) else f'{R}/{book}/{f}'))
    bad = 0
    for cid, e in data.items():
        if cid not in chs: print('UNKNOWN SECTION', cid); bad += 1; continue
        for k in ('essay', 'annotations', 'links'):
            if k not in e: print('MISSING KEY', cid, k); bad += 1
        for a in e.get('annotations', []):
            if not any(a['quote'] in p for p in chs[cid]['paras']):
                print('QUOTE NOT VERBATIM IN ONE PARAGRAPH', cid, repr(a['quote'][:70])); bad += 1
        refs = [l['to'] for l in e.get('links', [])]
        for t in [e.get('essay', '')] + [a['note'] for a in e.get('annotations', [])] + [l.get('why', '') for l in e.get('links', [])]:
            refs += re.findall(r'\[\[([a-z0-9]+)', t)
        for r in refs:
            if r not in chs and r not in allow: print('BAD LINK TARGET', cid, r); bad += 1
            if r == cid: print('SELF LINK', cid); bad += 1
        print(f"{cid:6} essay {len(e.get('essay','').split()):4} words, {len(e.get('annotations',[]))} notes, {len(e.get('links',[]))} links")
    print('sections', len(data), 'bad', bad)
else:
    print(__doc__)
