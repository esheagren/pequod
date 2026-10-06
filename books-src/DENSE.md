# Brief: a tutorial commentary on Antigone

The reader has Sophocles' Antigone open in F. Storr's 1912 verse translation, on a site that pins margin notes to
particular lines. The play already has a light layer of notes. You are replacing them, for your sections, with
something much denser: the line-by-line reading a good Oxford tutor would give a student who has read the play
once and now wants to know what is actually in it.

Run `python3 tools.py example` once to see the house register (first person, plain, specific). Then go further than
that example in density and in closeness to the words.

## What a note does

Work through the section in order and stop wherever there is something to say, which in this play is nearly
everywhere. A note may:
- say what a line is doing in the argument or the scene: a concession, a trap, a change of ground, a threat;
- point out an echo of an earlier line or a word that keeps returning, and say what the repetition is building;
- mark dramatic irony, staging, who is on stage and who is silent;
- name a real crux and set out the positions briefly (the two burials; whether lines 904–920 are Sophocles;
  whose side the Chorus is on at any moment; what the ode on man is praising);
- ask the question a tutor would ask, and then answer it or say why it stays open;
- say where you disagree with a standard reading. Refer to scholars or to Hegel only where you are sure of the
  attribution; never invent a citation and never give page numbers.

## The Greek

Much of what is interesting in this play lives in single Greek words that Storr could not carry over. Where the
original word changes or sharpens a line, bring it in:
- Read the Greek for your lines first: `python3 tools.py greek antigone <from> <to>`.
- Quote Greek only as it stands in Sophocles' text, in Greek script, a word or short phrase, followed by a
  transliteration in underscores for italics and a gloss: δεινά (_deina_, "terrible, wonderful, formidable").
  Dictionary forms and related words go in transliteration only (_deinos_), never in Greek script.
- Give the Greek line number exactly as the tool prints it, since Storr prints none: "(l. 333)".
- Then say what difference it makes: what Storr chose, what he narrowed, embellished or lost, and what the line
  means with the Greek word restored.
- Words that recur and matter across the play, to be tracked whenever they appear in your lines: philos / echthros
  (friend, kin / enemy), nomos and nomima (law, customs), kerdos (gain), phronein and its cousins (thinking,
  good sense), deinos, hybris, orge, autonomos, eusebeia and its opposite, ate, miasma, polis-words
  (hypsipolis, apolis), the vocabulary of kinship (autadelphos, homaimos), and of gender (aner, gyne).
- Do not force it. A third to a half of your notes should involve the Greek; the rest are about argument,
  structure, staging, and the English in front of the reader.
- Every Greek-script word is checked by machine against the text of the play. A word that is not there fails.

## Density and form

- Your task gives a target number of notes per section. Treat it as a floor for what the text deserves.
- Each `quote` is copied EXACTLY from Storr's text as the tools print it, inside ONE printed verse line,
  3 to 12 words: the phrase the note is about. The tools indent continuation lines when printing; the indentation
  is not part of the text. Quotes within one speech must not overlap each other.
- Each `note` is 2 to 6 sentences. One sharp sentence is allowed when that is all a line needs.
- Notes may point at other sections with `[[s5]]` or `[[s5|the unwritten laws speech]]` (ids s1 to s13).
- Keep whatever was right in the existing notes (`python3 tools.py notes antigone <id>`), absorbed into yours.
- The ending is known to every reader of this play; refer ahead freely.

## Output

A JSON file, named in your task, of the form {"s1": [{"quote": "...", "note": "..."}, ...], "s2": [...]},
notes in the order the lines occur. Verify with the command in your task until it prints `bad 0`.
Reply with one line: the file you wrote and the last verify line.
