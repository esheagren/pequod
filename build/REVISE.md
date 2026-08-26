# Revision brief — second pass on the Moby-Dick commentary

You already wrote commentary_N.json for your range (essay + annotations per section). Erik read it and said it is "quite good" and asked for two things. Do both, editing your JSON file IN PLACE (keep every section, keep existing annotations unless you improve them).

## 1. Go deeper on the chapters you feel strongly about
For the STRONG chapters listed in your prompt: rewrite the essay to 550–950 words, and in a more explanatory register — not just "this moves me" but *why*: what the sentence is doing mechanically, what it sets up or pays off elsewhere, what the usual reading is and where you depart from it, what a first-time reader is likely to miss. Still first person, still honest, still specific. Use 3–5 paragraphs separated by "\n\n". You may also add 2–5 further annotations to these chapters and expand existing notes to 3–6 sentences where a line deserves it. For the other chapters in your range, leave the essay length alone but feel free to sharpen.

## 2. Wire the connections across the book
Run `python3 titles.py` for every section id and title. Two mechanisms, use both:

(a) Inline links inside essay text and notes, syntax:
   [[ch42]]                      → renders "Ch. 42, The Whiteness of the Whale"
   [[ch42|the whiteness chapter]] → custom label
   [[ch36:pasteboard masks|Ahab's speech on the mask]] → jumps to ch36 AND scrolls to/flashes the line containing that quote fragment (fragment is case-insensitive substring of the target chapter's text; keep it short and distinctive, 2–6 words; verify it exists with `python3 dump.py ch36 | grep -i "pasteboard masks"`).
   Use links wherever you genuinely say "this pays off in…" / "remember…" / "compare…". Aim for 2–6 per strong chapter, 0–2 elsewhere. Links to sections outside your range are encouraged — that is the point.

(b) A `links` array on each section (add the key), listing the 1–5 most useful other sections to have open at that moment:
   "links": [{"to":"ch42","q":"optional quote fragment","why":"one sentence, in your voice, on why to look there now"}]
   Every section should have at least one link unless truly nothing connects. Do not link a section to itself.

## Rules
- Quotes in annotations must remain VERBATIM substrings; run `python3 verify.py commentary_N.json` until `bad 0`.
- Run `python3 build.py` at the end; it prints `BAD LINK TARGETS` if any [[id]] or "to" doesn't exist — fix until clean.
- Valid JSON; ensure_ascii not required. Don't touch any other file.
- Return only "done" + the last verify line + the build.py output line.
