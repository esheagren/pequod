"""Stitch the writers' pieces into finished book sources. Safe to re-run; reports what is still missing."""
import json, glob, os
R=os.path.dirname(os.path.abspath(__file__))
def J(p): return json.load(open(p))
def W(p,o): json.dump(o,open(p,'w'),ensure_ascii=False)
ready=[]

# ---- Crime and Punishment: chapter titles ----
b=f'{R}/crime-and-punishment'; chs=J(f'{b}/chapters.json'); titles={}
for f in sorted(glob.glob(f'{b}/titles_*.json')): titles.update(J(f))
for c in chs:
    if titles.get(c['id']): c['title']=titles[c['id']]
W(f'{b}/chapters.json',chs)
cm={}
for f in sorted(glob.glob(f'{b}/commentary_*.json')): cm.update(J(f))
missing=[c['id'] for c in chs if c['id'] not in cm or not c['title']]
print('crime-and-punishment: missing', missing or 'nothing'); ready += [] if missing else ['crime-and-punishment']

# ---- the two plays ----
for bid in ('oedipus-the-king','antigone'):
    b=f'{R}/{bid}'; need=[f for f in ('chapters.json','commentary_1.json','characters.json','movements.json') if not os.path.exists(f'{b}/{f}')]
    if need: print(f'{bid}: waiting for', need); continue
    chs=J(f'{b}/chapters.json')
    for c in chs:
        k=c.pop('kind',None) or c.get('kicker')
        if k: c['kicker']=k; c['ref']=k
    W(f'{b}/chapters.json',chs)
    meta=J(f'{b}/book.json'); meta['movements']=J(f'{b}/movements.json'); json.dump(meta,open(f'{b}/book.json','w'),ensure_ascii=False,indent=1)
    cm=J(f'{b}/commentary_1.json'); missing=[c['id'] for c in chs if c['id'] not in cm]
    print(f'{bid}: {len(chs)} sections, missing', missing or 'nothing'); ready += [] if missing else [bid]

# ---- Plato ----
b=f'{R}/five-dialogues'; meta=J(f'{b}/book.json'); order=[('eu','Euthyphro'),('ap','Apology'),('cr','Crito'),('me','Meno'),('pha','Phaedo'),('phb','Phaedo')]
need=[k for k,_ in order if not (os.path.exists(f'{b}/chapters_{k}.json') and os.path.exists(f'{b}/commentary_{k}.json'))]
if os.path.exists(f'{b}/chapters.json') and not need: need=[]
if need and not os.path.exists(f'{b}/chapters.json'): print('five-dialogues: waiting for', need)
else:
    if not os.path.exists(f'{b}/chapters.json') or glob.glob(f'{b}/chapters_*.json'):
        chs=[]; n={}
        for k,name in order:
            for c in J(f'{b}/chapters_{k}.json'):
                n[name]=n.get(name,0)+1; c['kicker']=name; c['ref']=f'{name} {n[name]}'; c['dialogue']=name; chs.append(c)
        W(f'{b}/chapters.json',chs)
        for f in glob.glob(f'{b}/chapters_*.json'): os.remove(f)
    chs=J(f'{b}/chapters.json')
    mv=[]
    for d in meta['dialogues']:
        ids=[c['id'] for c in chs if c['dialogue']==d['name']]
        mv.append(dict(name=d['name'],range=f'{len(ids)} sections',**{'from':ids[0]},to=ids[-1],desc=d['desc']))
    meta['movements']=mv; json.dump(meta,open(f'{b}/book.json','w'),ensure_ascii=False,indent=1)
    # resolve "first appearance" for persons who enter mid-dialogue
    people=J(f'{b}/characters.json')
    for p in people:
        if 'find' in p:
            hit=next((c['id'] for c in chs if c['id'].startswith(p['in_']) and any(p['find'] in para for para in c['paras'])),None)
            p['first']=hit or next(c['id'] for c in chs if c['id'].startswith(p['in_']))
            if not hit: print('  could not place', p['name'])
    json.dump(people,open(f'{b}/characters.json','w'),ensure_ascii=False,indent=1)
    cm={}
    for f in sorted(glob.glob(f'{b}/commentary_*.json')): cm.update(J(f))
    missing=[c['id'] for c in chs if c['id'] not in cm]
    print(f'five-dialogues: {len(chs)} sections, missing', missing or 'nothing'); ready += [] if missing else ['five-dialogues']
print('READY:', ready)
