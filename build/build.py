import json, glob, os
import os
B=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chs=json.load(open(f'{B}/build/chapters.json'))
idx={c['id']:i for i,c in enumerate(chs)}
cm={}
for f in sorted(glob.glob(f'{B}/build/commentary_*.json')):
    cm.update(json.load(open(f)))
chars=json.load(open(f'{B}/build/characters.json'))
mv=[
 dict(name='Ashore',range='Etymology – Ch. 22',from_=idx['etymology'],to=idx['ch22'],desc='New Bedford and Nantucket. Ishmael finds a bedfellow, a sermon, a ship, and a prophet; the sea is still a promise.'),
 dict(name='The Ship',range='Ch. 23 – 47',from_=idx['ch23'],to=idx['ch47'],desc='The Pequod at sea. The crew, the mates, Ahab at last, the doubloon nailed to the mast, and the whiteness of the whale.'),
 dict(name='The Hunt',range='Ch. 48 – 105',from_=idx['ch48'],to=idx['ch105'],desc='Lowering, killing, cutting-in, trying-out; other ships met; whole chapters given to the whale’s head, tail, skin, and skeleton.'),
 dict(name='The Chase',range='Ch. 106 – Epilogue',from_=idx['ch106'],to=idx['epilogue'],desc='The Pacific. The coffin, the forge, the candles, the Rachel, one quiet morning — and three days.'),
]
mv=[{'name':m['name'],'range':m['range'],'from':m['from_'],'to':m['to'],'desc':m['desc']} for m in mv]
import re
incoming={}
bad=[]
for cid,v in cm.items():
    refs=[l['to'] for l in v.get('links',[])]
    texts=[v['essay']]+[a['note'] for a in v['annotations']]+[l.get('why','') for l in v.get('links',[])]
    for t in texts: refs+=re.findall(r'\[\[([a-z0-9]+)',t)
    for r in refs:
        if r not in idx: bad.append((cid,r)); continue
        if r!=cid: incoming.setdefault(r,[])
        if r!=cid and cid not in incoming[r]: incoming[r].append(cid)
for k in incoming: incoming[k].sort(key=lambda i: idx[i])
if bad: print('BAD LINK TARGETS', bad)
n_links=sum(len(v.get('links',[])) for v in cm.values())+sum(len(re.findall(r'\[\[',v['essay']+' '.join(a['note'] for a in v['annotations']))) for v in cm.values())
print('cross-links',n_links)
audio={}
AUDIO_SRC=json.load(open(f'{B}/audio/sources.json')) if os.path.exists(f'{B}/audio/sources.json') else {}
for f in sorted(glob.glob(f'{B}/audio/cache/*.align.json')):
    for cid,v in json.load(open(f)).items():
        if cid in AUDIO_SRC: audio[cid]=dict(src=AUDIO_SRC[cid],paras=v['paras'])
tts=json.load(open(f'{B}/audio/tts.json')) if os.path.exists(f'{B}/audio/tts.json') else {}
print('audio chapters',sorted(audio, key=lambda c: idx[c]))
data=json.dumps(dict(chapters=chs,commentary=cm,characters=chars,movements=mv,incoming=incoming,audio=audio,tts=tts),ensure_ascii=False).replace('</','<\\/')
html=open(f'{B}/build/template.html').read().replace('__DATA__',data)
open(f'{B}/build/artifact.html','w').write(html)  # fragment, for the Claude artifact
full='<!doctype html>\n<html lang="en">\n<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="Moby-Dick, complete, with chapter essays and line-by-line marginalia from Claude.">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="manifest" href="/manifest.json">\n<meta name="apple-mobile-web-app-title" content="The Whale">\n<meta name="application-name" content="The Whale">\n<meta name="theme-color" content="#0C1218">\n'
head_end=html.index('</style>')+len('</style>')
full+=html[:head_end]+'\n</head>\n<body>\n'+html[head_end:]+'\n</body>\n</html>\n'
open(f'{B}/index.html','w').write(full)
n_ann=sum(len(v['annotations']) for v in cm.values())
print(f'sections {len(chs)}  essays {len(cm)}  annotations {n_ann}  size {len(html)/1e6:.2f} MB  missing {[c["id"] for c in chs if c["id"] not in cm][:5]}...')
