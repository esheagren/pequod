"""Turn the Gutenberg plain-text files in _raw/ into paragraph lists.
Prose paragraphs are joined onto one line; verse keeps its line breaks."""
import re, json, os
R=os.path.dirname(os.path.abspath(__file__))
def lines(n): return open(f'{R}/_raw/pg{n}.txt',encoding='utf-8-sig').read().replace('\r\n','\n').split('\n')
def paras(ls, verse=False):
    out=[]; cur=[]
    for l in ls+['']:
        if l.strip()=='' :
            if cur:
                out.append('\n'.join(x.strip() for x in cur) if verse else re.sub(r'\s+',' ',' '.join(cur)).strip()); cur=[]
        else: cur.append(l)
    return [p for p in out if p]
def words(ps): return sum(len(p.split()) for p in ps)

# ---- Crime and Punishment (Garnett) ----
L=lines(2554); end=next(i for i,l in enumerate(L) if l.startswith('*** END'))
ROM={'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8}
marks=[]; part=None
for i,l in enumerate(L[:end]):
    s=l.strip()
    if i<130: continue
    m=re.fullmatch(r'PART ([IVX]+)',s)
    if m: part=ROM[m.group(1)]; continue
    if s=='EPILOGUE': part='E'; continue
    m=re.fullmatch(r'CHAPTER ([IVX]+)',s)
    if m and part!='E': marks.append((i,part,ROM[m.group(1)])); continue
    if part=='E' and s in ('I','II'): marks.append((i,'E',ROM[s]))
PARTN=['','One','Two','Three','Four','Five','Six']
chs=[]
for k,(i,part,c) in enumerate(marks):
    seg=L[i+1: marks[k+1][0] if k+1<len(marks) else end]
    seg=[x for x in seg if not re.fullmatch(r'\s*(PART [IVX]+|EPILOGUE)\s*',x)]
    if part=='E': cid=f'ep{c}'; kicker=f'Epilogue · {c}'; ref=f'Epilogue {c}'
    else: cid=f'p{part}c{c}'; kicker=f'Part {PARTN[part]} · Chapter {c}'; ref=f'{["","I","II","III","IV","V","VI"][part]}.{c}'
    chs.append(dict(id=cid,num=c,part=part,kicker=kicker,ref=ref,title='',paras=paras(seg)))
os.makedirs(f'{R}/crime-and-punishment',exist_ok=True)
json.dump(chs,open(f'{R}/crime-and-punishment/chapters.json','w'),ensure_ascii=False)
print('C&P chapters',len(chs),'words',sum(words(c['paras']) for c in chs))
print('  sizes(k words):',' '.join(f"{c['id']}:{words(c['paras'])/1000:.1f}" for c in chs))

# ---- Sophocles (Storr) ----
L=lines(31)
f0=next(i for i,l in enumerate(L) if l.strip()=='FOOTNOTES')
o0=max(i for i,l in enumerate(L[:f0]) if l.strip()=='OEDIPUS THE KING')
oed=paras(L[o0+1:f0], verse=True)
a0=max(i for i,l in enumerate(L) if l.strip()=='ANTIGONE')
aend=next(i for i in range(a0,len(L)) if L[i].startswith('*** END') or L[i].strip()=='FOOTNOTES')
ant=paras(L[a0+1:aend], verse=True)
for bid,ps in (('oedipus-the-king',oed),('antigone',ant)):
    os.makedirs(f'{R}/{bid}',exist_ok=True); json.dump(ps,open(f'{R}/{bid}/raw.json','w'),ensure_ascii=False)
    print(bid,'paragraphs',len(ps),'words',words(ps),'| first:',ps[0][:60].replace('\n',' / '),'| last:',ps[-1][-60:].replace('\n',' / '))

# ---- Plato (Jowett) ----
os.makedirs(f'{R}/five-dialogues',exist_ok=True)
for key,n,title in (('eu',1642,'EUTHYPHRO'),('ap',1656,'APOLOGY'),('cr',1657,'CRITO'),('me',1643,'MENO'),('ph',1658,'PHAEDO')):
    L=lines(n); end=next(i for i,l in enumerate(L) if l.startswith('*** END'))
    start=max(i for i,l in enumerate(L[:end]) if l.strip()==title)
    pers=[i for i,l in enumerate(L[:end]) if l.startswith('PERSONS OF THE DIALOGUE')]
    if pers: start=pers[-1]-1
    ps=paras(L[start+1:end])
    if key=='ph':
        # two writers share the Phaedo; split at Echecrates' interruption after the objections
        k=next(i for i,p in enumerate(ps) if p.startswith('ECHECRATES: There I feel with you'))
        json.dump(ps[:k],open(f'{R}/five-dialogues/raw_pha.json','w'),ensure_ascii=False)
        json.dump(ps[k:],open(f'{R}/five-dialogues/raw_phb.json','w'),ensure_ascii=False)
        print('  phaedo split at paragraph',k,'words',words(ps[:k]),'+',words(ps[k:]))
        continue
    json.dump(ps,open(f'{R}/five-dialogues/raw_{key}.json','w'),ensure_ascii=False)
    print(key,'paragraphs',len(ps),'words',words(ps),'| first:',ps[0][:70],'| last:',ps[-1][-50:])
