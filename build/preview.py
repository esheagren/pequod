"""Create a self-contained local preview; open reader-preview.html in a browser."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
html = html.replace('<link rel="manifest" href="/manifest.json">', '')
html = html.replace('href="/favicon-32.png"', 'href="favicon-32.png"').replace('href="/apple-touch-icon.png"', 'href="apple-touch-icon.png"')
books = {p.stem: json.loads(p.read_text()) for p in (root / 'books').glob('*.json')}
inline = json.dumps(books, ensure_ascii=False).replace('</', '<\\/')
html = html.replace('<script>\n(async function(){', '<script>\nconst LOCAL_BOOKS=' + inline + ';\n(async function(){', 1)
html = html.replace("const res = await fetch('books/'", "const res = LOCAL_BOOKS[BOOK] ? {ok:true,json:async()=>LOCAL_BOOKS[BOOK]} : await fetch('books/'", 1)
html = html.replace('/* ---- boot ---- */', (root / 'build/reader-qa.js').read_text() + '\n/* ---- boot ---- */', 1)
(root / 'reader-preview.html').write_text(html)
print('reader-preview.html: all public books embedded for local review')
