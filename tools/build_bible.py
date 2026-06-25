#!/usr/bin/env python3
"""
Build a "read straight through" plain-text Bible for the Speed Reading Video
Maker (RSVP) app.

The output contains ONLY the book titles as separators. Every verse is included
as continuous prose with:
  - no verse numbers
  - no chapter numbers or "Chapter N" headings
  - no section/editorial headings
  - no footnote or apparatus markers

Source translation: Bible in Basic English (BBE), which is in the PUBLIC DOMAIN.
Data file: thiagobodruk/bible (en_bbe.json) on GitHub.

Usage:
    python3 tools/build_bible.py              # fetch source over the network
    python3 tools/build_bible.py --input en_bbe.json   # use a local copy

Outputs (written next to the repo root, under ./bible/):
    bible/bible-bbe.txt                     full 66-book Bible
    bible/bible-bbe-old-testament.txt       Genesis .. Malachi
    bible/bible-bbe-new-testament.txt       Matthew .. Revelation
    bible/books/NN-Book-Name.txt            one file per book
"""

import argparse
import http.client
import json
import os
import re
import sys
import urllib.error
import urllib.request

SOURCE_URL = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_bbe.json"

# 66 books, in canonical order. The source JSON is already in this order; we map
# by position so the short abbreviations in the data never reach the output.
BOOK_NAMES = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
    "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
]

# Genesis .. Malachi is 39 books; the remaining 27 are the New Testament.
OT_COUNT = 39

# Markers to strip from BBE verse text:
#   ***   -> source text uncertain / missing in the manuscripts.
#   [ ]   -> editorial brackets. Empty "[]" marks a verse absent from the
#           critical text. Brackets can also span several verses around a
#           textually disputed but genuine passage (e.g. John 7:53-8:11, the
#           woman caught in adultery). We remove only the bracket CHARACTERS,
#           never the words, so disputed-but-real scripture is kept intact.
# Parentheses "( )" are NORMAL prose ("Bela (that is Zoar)") and are kept.
_ASTERISKS = re.compile(r"\*+")
_WS = re.compile(r"\s+")


def clean_verse(text):
    """Strip editorial markers and normalise whitespace in a single verse."""
    text = text.replace("[", " ").replace("]", " ")
    text = _ASTERISKS.sub(" ", text)
    text = _WS.sub(" ", text)
    return text.strip()


def fetch(url, attempts=4):
    """Fetch a URL, retrying on the truncated reads some proxies produce."""
    last_err = None
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(url, timeout=120) as resp:
                return resp.read()
        except (http.client.IncompleteRead, urllib.error.URLError, TimeoutError) as err:
            last_err = err
            sys.stderr.write("  fetch attempt %d failed (%s); retrying...\n" % (attempt, err))
    raise SystemExit("Could not download %s: %s\nTip: download it manually and pass --input." % (url, last_err))


def load_source(input_path):
    if input_path:
        with open(input_path, "rb") as fh:
            raw = fh.read()
    else:
        sys.stderr.write("Fetching %s ...\n" % SOURCE_URL)
        raw = fetch(SOURCE_URL)
    # The source file is UTF-8 with a BOM.
    return json.loads(raw.decode("utf-8-sig"))


def book_to_text(book):
    """Return one book as 'Title\\n\\n<chapter paragraphs>'.

    Chapters are separated by a blank line purely for human readability of the
    raw file; the RSVP app collapses all whitespace, so this is invisible while
    reading. No chapter numbers or headings are emitted.
    """
    paragraphs = []
    for chapter in book["chapters"]:
        verses = [clean_verse(v) for v in chapter]
        verses = [v for v in verses if v]  # drop verses that were only markers
        if verses:
            paragraphs.append(" ".join(verses))
    return "\n\n".join(paragraphs)


def slugify(name):
    return name.replace(" ", "-")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", help="Path to a local en_bbe.json (else fetch over network)")
    args = parser.parse_args()

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(repo_root, "bible")
    books_dir = os.path.join(out_dir, "books")
    os.makedirs(books_dir, exist_ok=True)

    data = load_source(args.input)
    if len(data) != len(BOOK_NAMES):
        raise SystemExit("Expected %d books, source has %d" % (len(BOOK_NAMES), len(data)))

    book_blocks = []
    total_words = 0
    for i, book in enumerate(data):
        title = BOOK_NAMES[i]
        body = book_to_text(book)
        block = "%s\n\n%s\n" % (title, body)
        book_blocks.append(block)
        total_words += len(body.split())

        per_book = "%s\n\n%s" % (title, body)
        fname = "%02d-%s.txt" % (i + 1, slugify(title))
        with open(os.path.join(books_dir, fname), "w", encoding="utf-8") as fh:
            fh.write(per_book.rstrip() + "\n")

    def write_combined(path, blocks):
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("\n\n".join(b.rstrip() for b in blocks) + "\n")

    write_combined(os.path.join(out_dir, "bible-bbe.txt"), book_blocks)
    write_combined(os.path.join(out_dir, "bible-bbe-old-testament.txt"), book_blocks[:OT_COUNT])
    write_combined(os.path.join(out_dir, "bible-bbe-new-testament.txt"), book_blocks[OT_COUNT:])

    sys.stderr.write(
        "Wrote %d books, %d words to %s\n" % (len(data), total_words, out_dir)
    )


if __name__ == "__main__":
    main()
