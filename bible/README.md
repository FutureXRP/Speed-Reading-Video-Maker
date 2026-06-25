# Readable Bible for the Speed Reading Video Maker

Plain-text Bible files built to be **read straight through** in the RSVP speed
reader. Every verse is included as continuous prose. The **only** identifiers in
the text are the **book titles** — there are no verse numbers, no chapter
numbers, no "Chapter N" headings, and no section or footnote markers.

While reading, each book title flashes by as a single word right before that
book begins (e.g. `… in a chest in Egypt.` → **`Exodus`** → `Now these are the
names …`). That is the only cue that a new book has started.

## Translation & license

**Bible in Basic English (BBE)** — a translation that uses a deliberately small
(~1000 word) vocabulary, which makes it easy to read at speed. The BBE is in the
**public domain**, so these files are free to use, share, and upload anywhere.

## Files

| File | Words | Duration @300 WPM | @900 WPM (app max) |
| --- | ---: | ---: | ---: |
| `bible-bbe.txt` (whole Bible, 66 books) | 840,692 | ~46.7 h | ~15.6 h |
| `bible-bbe-old-testament.txt` (Genesis–Malachi) | 639,811 | ~35.5 h | ~11.8 h |
| `bible-bbe-new-testament.txt` (Matthew–Revelation) | 200,881 | ~11.2 h | ~3.7 h |
| `books/NN-Book-Name.txt` | one file per book | — | — |

## How to use

1. Open the Speed Reading Video Maker (`index.html`).
2. Under **1) Input text**, click one of the **Load Bible (BBE)** buttons —
   **Old Testament**, **New Testament**, or **Whole Bible**. The text loads into
   the box and the words are prepared automatically.
3. Press **Play** (or the spacebar) to read. Use the seek bar to jump to where
   you left off.

You can also use **Upload .txt** to pick any of these files (including a single
book from `books/`) by hand, then click **Prepare words**.

**Note:** the one-click buttons read the files over the network, so the page must
be served over **http(s)** (e.g. GitHub Pages, or `python3 -m http.server`). If
you open `index.html` straight from disk (a `file://` URL) the buttons can't load
the files — use **Upload .txt** in that case.

**Tip:** the whole-Bible file is ~4 MB and ~840k words; it works, but it can take
a moment to "Prepare" and is a long sit. To start smaller, use **New Testament**
or a single book from `books/`.

## Regenerating these files

The text is built by `tools/build_bible.py`, which downloads the public-domain
BBE source, strips all verse/chapter/editorial markers, and keeps only the book
titles:

```bash
python3 tools/build_bible.py                 # downloads the source
python3 tools/build_bible.py --input bbe.json # or use a local copy
```

Source data: the `en_bbe.json` file from the public-domain
[`thiagobodruk/bible`](https://github.com/thiagobodruk/bible) dataset.

### Cleaning notes

- `***` (BBE's marker for text missing/uncertain in the manuscripts) is removed.
- Empty editorial brackets `[]` (verses absent from the critical text) are removed.
- The cross-verse brackets around **John 7:53–8:11** (the woman caught in
  adultery) have their bracket characters removed but the **passage is kept** —
  it is disputed but genuine scripture.
- Parentheses `( )` are ordinary prose (e.g. *"Bela (that is Zoar)"*) and are kept.
