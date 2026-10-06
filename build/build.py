"""Build Pequod.

A book is a source folder holding:
  book.json          title/author/cover prose/movements (see build/book.json)
  chapters.json      [{id, num, title, paras:[...]}]
  commentary_*.json  {section_id: {essay, annotations:[{quote, note}], links:[{to, q, why}]}}
  characters.json    optional

Public books:  build/ (Moby-Dick) and books-src/<id>/   -> books/<id>.json, listed on the shelf.
Private books: private-src/<id>/ (gitignored; in-copyright text you own, never committed or deployed)
               -> only built with --private, into private/ (also gitignored), a complete local copy of the site:
                    python3 build/build.py --private && python3 -m http.server -d private 8740
"""
import json, glob, os, re, shutil, sys

B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIVATE = '--private' in sys.argv


def load_book(src):
    meta = json.load(open(f'{src}/book.json'))
    chs = json.load(open(f'{src}/chapters.json'))
    idx = {c['id']: i for i, c in enumerate(chs)}
    cm = {}
    for f in sorted(glob.glob(f'{src}/commentary_*.json')):
        cm.update(json.load(open(f)))
    chars = json.load(open(f'{src}/characters.json')) if os.path.exists(f'{src}/characters.json') else []
    mv = [dict(name=m['name'], range=m['range'], desc=m.get('desc', ''), **{'from': idx[m['from']], 'to': idx[m['to']]})
          for m in meta.pop('movements')]

    # back-links: which sections point at each section (Threads block + cover arcs)
    incoming, bad = {}, []
    for cid, v in cm.items():
        refs = [l['to'] for l in v.get('links', [])]
        texts = [v.get('essay', '')] + [a['note'] for a in v.get('annotations', [])] + [l.get('why', '') for l in v.get('links', [])]
        for t in texts:
            refs += re.findall(r'\[\[([a-z0-9]+)', t)
        for r in refs:
            if r not in idx:
                bad.append((cid, r)); continue
            if r != cid and cid not in incoming.setdefault(r, []):
                incoming[r].append(cid)
    for k in incoming:
        incoming[k].sort(key=lambda i: idx[i])
    if bad:
        print('BAD LINK TARGETS', meta['id'], bad)

    # every annotation must quote its section verbatim, or it cannot be pinned
    misses = 0
    for cid, v in cm.items():
        text = '\n'.join(chs[idx[cid]]['paras']) if cid in idx else ''
        misses += sum(1 for a in v.get('annotations', []) if a['quote'] not in text)
    if misses:
        print('UNPINNED QUOTES', meta['id'], misses)

    # narration sync (optional; only Moby-Dick has it so far)
    audio, tts = {}, {}
    if meta['id'] == 'moby-dick':
        srcs = json.load(open(f'{B}/audio/sources.json')) if os.path.exists(f'{B}/audio/sources.json') else {}
        for f in sorted(glob.glob(f'{B}/audio/cache/*.align.json')):
            for cid, v in json.load(open(f)).items():
                if cid in srcs:
                    audio[cid] = dict(src=srcs[cid], paras=v['paras'])
        tts = json.load(open(f'{B}/audio/tts.json')) if os.path.exists(f'{B}/audio/tts.json') else {}

    n_ann = sum(len(v.get('annotations', [])) for v in cm.values())
    stats = f"{len(chs)} {meta.get('unit', 'sections')} · {n_ann:,} notes" + (' · read-along audio' if audio else '')
    data = dict(meta=meta, chapters=chs, commentary=cm, characters=chars, movements=mv, incoming=incoming, audio=audio, tts=tts)
    card = dict(id=meta['id'], title=meta['title'], sub=meta.get('sub', ''), author=meta.get('author', ''),
                year=meta.get('year', ''), icon=meta.get('icon', 'book'), stats=stats)
    print(f"  {meta['id']}: {len(chs)} sections, {len(cm)} essays, {n_ann} notes, {len(audio)} audio, missing essays {[c['id'] for c in chs if c['id'] not in cm][:5]}")
    return data, card


def dumps(o):
    return json.dumps(o, ensure_ascii=False).replace('</', '<\\/')


def page(template, shelf, embed=''):
    html = template.replace('__SHELF__', dumps(shelf)).replace('__DATA__', embed)
    head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<meta name="description" content="Pequod: whole books, chapter by chapter, with a reader\'s marginalia.">\n'
            '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n'
            '<link rel="manifest" href="/manifest.json">\n<meta name="apple-mobile-web-app-title" content="Pequod">\n<meta name="application-name" content="Pequod">\n<meta name="theme-color" content="#0C1218">\n')
    cut = html.index('</style>') + len('</style>')
    return html, head + html[:cut] + '\n</head>\n<body>\n' + html[cut:] + '\n</body>\n</html>\n'


def main():
    template = open(f'{B}/build/template.html').read()
    sources = [f'{B}/build'] + sorted(d for d in glob.glob(f'{B}/books-src/*') if os.path.exists(f'{d}/book.json'))
    private_sources = sorted(d for d in glob.glob(f'{B}/private-src/*') if os.path.exists(f'{d}/book.json'))

    print('public books')
    books = [load_book(s) for s in sources]
    os.makedirs(f'{B}/books', exist_ok=True)
    for data, card in books:
        open(f"{B}/books/{card['id']}.json", 'w').write(json.dumps(data, ensure_ascii=False))
    shelf = [card for _, card in books]
    _, full = page(template, shelf)
    open(f'{B}/index.html', 'w').write(full)
    # single-file build with Moby-Dick inline, for the Claude artifact
    moby = next(d for d, c in books if c['id'] == 'moby-dick')
    fragment, _ = page(template, [c for c in shelf if c['id'] == 'moby-dick'], dumps(moby))
    open(f'{B}/build/artifact.html', 'w').write(fragment)
    print(f"shelf {[c['id'] for c in shelf]}  index.html {len(full)/1e3:.0f} KB")

    if PRIVATE:
        print('private books')
        out = f'{B}/private'
        os.makedirs(f'{out}/books', exist_ok=True)
        pbooks = [load_book(s) for s in private_sources]
        for data, card in books + pbooks:
            open(f"{out}/books/{card['id']}.json", 'w').write(json.dumps(data, ensure_ascii=False))
        _, pfull = page(template, shelf + [c for _, c in pbooks])
        open(f'{out}/index.html', 'w').write(pfull)
        for f in ('favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'manifest.json'):
            if os.path.exists(f'{B}/{f}'):
                shutil.copy(f'{B}/{f}', f'{out}/{f}')
        if os.path.exists(f'{B}/audio/tts') and not os.path.exists(f'{out}/audio'):
            os.makedirs(f'{out}/audio'); shutil.copytree(f'{B}/audio/tts', f'{out}/audio/tts')
        print(f"private shelf {[c['id'] for c in shelf] + [c['id'] for _, c in pbooks]} -> private/")
    elif private_sources:
        print(f'({len(private_sources)} private book source(s) present; run with --private to build private/)')


if __name__ == '__main__':
    main()
