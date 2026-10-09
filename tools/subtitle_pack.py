"""Writes the subtitle translation packs (subtitles/<code>.txt next to pt) from an upstream pt-pc checkout.

The Turkish, Chinese, Arabic, Russian, Ukrainian and Czech subtitles are translations of the game's script, so this fork does not
carry them; the game reads them at run time from subtitles/<code>.txt (src/engine/core/subtitle_translations.cpp) and
shows the English subtitles for a language without its pack. The translations come from the kSubtitles tables of
src/engine/core/<language>_text.h in LoreanXavier/pt-pc (any checkout; Czech from 1.0.2 on):

    python tools/subtitle_pack.py <upstream pt-pc checkout> <folder with pt>

Pack format: UTF-8, one subtitle line per text line, "<key as 8 hex digits><tab><text>", the lines of one key in order;
"|" is a line break inside a subtitle line.
"""
import re, sys
from pathlib import Path

LANGUAGES = {"turkish": "Tur", "chinese": "Zhs", "arabic": "Ara", "russian": "Rus", "ukrainian": "Ukr", "czech": "Ces"}


def entries(header):
    text = header.read_text(encoding="utf-8")
    start = text.find("kSubtitles[]")
    if start < 0:
        sys.exit(f"{header}: no kSubtitles table")
    table = text[start:]
    for match in re.finditer(r"\{0x([0-9A-Fa-f]{8}),\{(.*?)\}\}", table, re.S):
        yield match.group(1).upper(), re.findall(r'"((?:[^"\\]|\\.)*)"', match.group(2))


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    source, out = Path(sys.argv[1]), Path(sys.argv[2]) / "subtitles"
    out.mkdir(parents=True, exist_ok=True)
    for name, code in LANGUAGES.items():
        rows = [f"{key}\t{line}" for key, lines in entries(source / "src/engine/core" / f"{name}_text.h") for line in lines]
        (out / f"{code}.txt").write_text("\n".join(rows) + "\n", encoding="utf-8")
        print(f"{out / code}.txt: {len(rows)} lines")


if __name__ == "__main__":
    main()
