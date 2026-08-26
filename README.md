# Book Assistant — *The Whale, Annotated*

A reading companion for *Moby-Dick*: the complete 1851 text, chapter by chapter, with a
chapter essay and line-pinned marginal notes written by Claude, cross-linked across the
book, plus a Crew tab of characters.

**Live:** deployed on Vercel (see the repo's deployments).

## Layout

- `index.html` — the whole app, one self-contained file (text + commentary embedded as JSON).
- `build/` — the pipeline that produces it:
  - `split.py` — Project Gutenberg #2701 → `chapters.json`
  - `commentary_1..9.json` — per-section `essay`, `annotations` (verbatim `quote` + `note`), and `links`
  - `characters.json` — the Crew tab
  - `template.html` — CSS/JS shell; `__DATA__` is replaced at build time
  - `build.py` — merges everything, validates link targets, writes `index.html` (+ `artifact.html`)
  - `verify.py` — checks every annotation quote is a verbatim substring of the text
  - `REVISE.md` — the brief used for the second commentary pass

## Rebuild

```sh
cd build
python3 verify.py commentary_3.json   # optional, per file
python3 build.py
```

## Commentary syntax

Inside essays and notes: `[[ch42]]`, `[[ch42|label]]`, or `[[ch42:quote fragment|label]]`
(jumps to the chapter and flashes the line). Each section may also carry
`"links": [{"to": "ch42", "q": "optional fragment", "why": "…"}]`, rendered as the
Threads block; back-links are computed at build time.

Text: Project Gutenberg, public domain. Commentary © Erik Sheagren / Claude.
