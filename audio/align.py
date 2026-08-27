"""Align a Whisper word-timestamp transcript to the known book text.

Usage: align.py <words.json> <chapter ids...>  -> writes cache/<ids>.align.json and prints a report.

Method: tokenize both the transcript and the target chapters the same way,
run difflib on the token streams, copy timestamps onto matched book words,
and interpolate for any book word Whisper missed. Output is per paragraph:
[[charStart, charEnd, t0, t1], ...] so the page can highlight at word,
sentence, or annotation granularity from character offsets alone.
"""
import json, re, sys, difflib, unicodedata

def norm(tok):
    t = unicodedata.normalize('NFKD', tok).encode('ascii', 'ignore').decode()
    t = t.lower().replace("’", "'")
    return re.sub(r"[^a-z0-9']", '', t)

WORD = r"[A-Za-zÀ-ÿ0-9’']+(?:-[A-Za-zÀ-ÿ0-9’']+)*"

def tokenize_text(s):
    for m in re.finditer(WORD, s):
        pos = m.start()
        for p in m.group(0).split('-'):
            n = norm(p)
            if n: yield (pos, pos + len(p), n)
            pos += len(p) + 1

def main(words_path, ids):
    words = json.load(open(words_path))
    chapters = {c['id']: c for c in json.load(open('../build/chapters.json'))}
    tt = []
    for w in words:
        for m in re.finditer(WORD, w['w']):
            for p in m.group(0).split('-'):
                n = norm(p)
                if n: tt.append((n, w['s'], w['e']))
    bt = []
    for cid in ids:
        for pi, p in enumerate(chapters[cid]['paras']):
            for cs, ce, n in tokenize_text(p):
                bt.append((cid, pi, cs, ce, n))
    sm = difflib.SequenceMatcher(None, [t[0] for t in tt], [b[4] for b in bt], autojunk=False)
    times = [None] * len(bt); matched = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(j2 - j1):
                times[j1 + k] = (tt[i1 + k][1], tt[i1 + k][2]); matched += 1
    known = [i for i, t in enumerate(times) if t]
    import bisect
    for i, t in enumerate(times):
        if t: continue
        k = bisect.bisect_left(known, i)
        prev = known[k-1] if k > 0 else None
        nxt = known[k] if k < len(known) else None
        if prev is None and nxt is None: times[i] = (0.0, 0.0)
        elif prev is None: times[i] = (times[nxt][0], times[nxt][0])
        elif nxt is None: times[i] = (times[prev][1], times[prev][1])
        else:
            a, b = times[prev][1], times[nxt][0]; span = nxt - prev
            times[i] = (round(a + (b-a)*(i-prev-1)/span, 2), round(a + (b-a)*(i-prev)/span, 2))
    last = 0.0
    for i, (s, e) in enumerate(times):
        s = max(s, last); e = max(e, s); times[i] = (round(s,2), round(e,2)); last = e
    out = {}
    for i, (cid, pi, cs, ce, n) in enumerate(bt):
        out.setdefault(cid, {}).setdefault(pi, []).append([cs, ce, times[i][0], times[i][1]])
    result = {cid: {'paras': [out[cid].get(pi, []) for pi in range(len(chapters[cid]['paras']))]} for cid in ids}
    tag = '_'.join(ids)
    json.dump(result, open(f'cache/{tag}.align.json', 'w'))
    print(f'book tokens {len(bt)}  transcript tokens {len(tt)}  matched {matched} ({matched/len(bt):.1%})')
    for cid in ids:
        ps = result[cid]['paras']
        first = next(p for p in ps if p); lastp = next(p for p in reversed(ps) if p)
        print(f'  {cid}: starts {first[0][2]:.1f}s  ends {lastp[-1][3]:.1f}s  paragraphs {len(ps)}')
    runs = []
    for tag_, i1, i2, j1, j2 in sm.get_opcodes():
        if tag_ != 'equal' and (j2 - j1) > 6:
            b = bt[j1]; runs.append((j2 - j1, tag_, b[0], b[1], ' '.join(x[4] for x in bt[j1:j1+8])))
    for r in sorted(runs, reverse=True)[:8]: print('  gap', r)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
