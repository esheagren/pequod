import re, json
raw = open('mobydick.txt', encoding='utf-8').read().replace('\r\n','\n')
lines = raw.split('\n')
start_line = next(i for i,l in enumerate(lines) if i>300 and l.strip()=='ETYMOLOGY.')
end = raw.index('*** END OF THE PROJECT')
body = '\n'.join(lines[start_line:])
body = body[:body.index('*** END OF THE PROJECT')]
pat = re.compile(r'^(CHAPTER (\d+)\. (.+?)\.?\s*$|\s*ETYMOLOGY\.\s*$|\s*EXTRACTS\. \(Supplied.*$|Epilogue\s*$)', re.M)
marks = list(pat.finditer(body))
chapters=[]
for i,m in enumerate(marks):
    seg = body[m.end(): marks[i+1].start() if i+1<len(marks) else len(body)]
    head = m.group(0).strip()
    if m.group(2):
        num=int(m.group(2)); title=m.group(3).strip().rstrip('.'); cid=f"ch{num}"
    elif head.startswith('ETYMOLOGY'): num=None; title='Etymology'; cid='etymology'
    elif head.startswith('EXTRACTS'): num=None; title='Extracts'; cid='extracts'
    else: num=None; title='Epilogue'; cid='epilogue'
    paras=[re.sub(r'\s+',' ',p).strip() for p in re.split(r'\n\s*\n', seg)]
    paras=[p for p in paras if p and p!='EXTRACTS.']
    chapters.append(dict(id=cid,num=num,title=title,paras=paras))
json.dump(chapters, open('chapters.json','w'), ensure_ascii=False)
print(len(chapters), sum(len(c['paras']) for c in chapters), sum(len(p) for c in chapters for p in c['paras']))
for c in chapters[:3]+chapters[-2:]: print(c['id'], c['title'], len(c['paras']), c['paras'][0][:70])
print([c['num'] for c in chapters if c['num']]==list(range(1,136)))
