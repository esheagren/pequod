"""Replace a book's line notes with the dense tutorial notes in dense_*.json (essays and links are kept)."""
import json, glob, os, sys
R=os.path.dirname(os.path.abspath(__file__)); book=sys.argv[1]; b=f'{R}/{book}'
cm=json.load(open(f'{b}/commentary_1.json')); chs={c['id']:c for c in json.load(open(f'{b}/chapters.json'))}
if not os.path.exists(f'{b}/notes_light.json'):   # keep the original light layer, once
    json.dump({k:v['annotations'] for k,v in cm.items()}, open(f'{b}/notes_light.json','w'), ensure_ascii=False)
done=[]
for f in sorted(glob.glob(f'{b}/dense_*.json')):
    for sid, notes in json.load(open(f)).items():
        def pos(a):
            for i,p in enumerate(chs[sid]['paras']):
                k=p.find(a['quote'])
                if k>=0: return (i,k)
            return (10**6,0)
        cm[sid]['annotations']=sorted(notes,key=pos); done.append(sid)
json.dump(cm,open(f'{b}/commentary_1.json','w'),ensure_ascii=False)
print('dense sections:',sorted(done,key=lambda s:int(s[1:])),'| still light:',[k for k in cm if k not in done])
print('total notes',sum(len(v['annotations']) for v in cm.values()))
