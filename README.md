# Book Assistant — *The Whale, Annotated*

A reading companion for *Moby-Dick*: the complete 1851 text, chapter by chapter, with a
chapter essay and line-pinned marginal notes written by Claude, cross-linked across the
book, plus a Crew tab of characters.

**Live:** https://pequod.vercel.app

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

## Book reader

Opening a book shows a short introduction: the author, the world of the work,
and why it matters. **Enter the work** starts reading; **Continue reading** restores
your place. The whale logo returns to the top of the homepage.

The reader shows a two-page spread on wide screens and a single page on smaller
ones. A sheet rotates around the spine when you turn with the edge arrows,
keyboard arrows, or a horizontal swipe. Reduced-motion preferences skip the flip.
Labeled dots above the book jump to chapters or major sections.

The current experiment uses comments attached to annotated lines. Clicking a
passage opens its complete note beside the clicked line, with a highlighted
passage and a small connector. Character names open reminders in the same
popover. Comments close with Escape, the close button, a click outside, or a
page turn. On narrow screens they fit above or below the line when needed.
**Chapter reading** remains in the right-hand panel.

The bottom notes dock is retained but hidden, and the book fills the recovered
space. Add `notes=bottom` to the book URL to compare the previous layout, for
example `?b=antigone&notes=bottom#s1`. No commentary or character data is removed.
Aliases and additional people mentioned in the text remain in each book's
character and metadata files.

The small top-right icon opens resources to the left. The panel starts closed. The panel opens wider by default; drag its left edge to adjust
its width, or use the arrow keys when the divider is focused. Double-click the
divider to reset. Your chosen width is remembered in this browser. Author and historical context live in the introduction;
the reader's drawer contains the current chapter reading under one heading.

The reader source is `build/reader.css` and `build/reader.js`, included by
`build/build.py` in the generated site and single-book artifact. Page sizes adapt
to the viewport; saved positions use a paragraph and text offset.

To review all public books without a web server:

```sh
python3 build/build.py
python3 build/preview.py
open reader-preview.html
```

The preview embeds public book data and is excluded from Git and deployment.
Run `node build/check-reader.js` for text-preservation and position regression checks.
`JSON.stringify(readerQA())` in its browser console checks sample chapters across
every movement, the longest section, text preservation, page reachability, note
selection, saved positions, and chapter boundaries. The QA helper is only included
in the local preview.

## Commentary syntax

Inside essays and notes: `[[ch42]]`, `[[ch42|label]]`, or `[[ch42:quote fragment|label]]`
(jumps to the chapter and flashes the line). Each section may also carry
`"links": [{"to": "ch42", "q": "optional fragment", "why": "…"}]`, rendered as the
Threads block; back-links are computed at build time.

Text: Project Gutenberg, public domain. Commentary © Erik Sheagren / Claude.

## Multiple books (2026-10-06)

Pequod is now a shelf. `index.html` is a small shell; each book is one data file, `books/<id>.json`, fetched when the book is opened (`/?b=<id>#<section>`; old `/#ch36` links redirect to Moby-Dick).

A book is a source folder with `book.json` (title, author, cover prose, movements), `chapters.json`, `commentary_*.json`, and optionally `characters.json`. Moby-Dick's source is `build/`; further public books go in `books-src/<id>/`. `python3 build/build.py` builds them all and checks that every note's quote is verbatim.

**Private books.** This repository and the site are public, so only public-domain text belongs here. For in-copyright translations you own, put the source folder in `private-src/<id>/` (gitignored, never deployed) and run `python3 build/build.py --private`, which writes a complete local copy of the site, including those books, to `private/` (also gitignored). Serve it with `python3 -m http.server -d private 8740`.
