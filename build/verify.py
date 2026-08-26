import json,sys
chs={c['id']:c for c in json.load(open('chapters.json'))}
data=json.load(open(sys.argv[1])); bad=0
for cid,entry in data.items():
    text='\n'.join(chs[cid]['paras'])
    for a in entry['annotations']:
        if a['quote'] not in text: bad+=1; print('MISSING', cid, repr(a['quote'][:60]))
print('sections',len(data),'bad',bad)
