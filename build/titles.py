import json
for c in json.load(open('chapters.json')): print(c['id'], '—', c['title'])
