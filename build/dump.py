import json,sys
chs=json.load(open('chapters.json'))
ids=sys.argv[1:]
for c in chs:
    if c['id'] in ids:
        print(f"\n===== {c['id']} | {c['title']} =====")
        for i,p in enumerate(c['paras']): print(f"[{i}] {p}")
