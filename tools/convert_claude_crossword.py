#!/usr/bin/env python3
"""Convert a Claude-style Persian crossword JSON to a *draft* Jadval v3.

The converter never guesses clues: it requires a local approved bank with
question/answer records. It does not alter the bank or publish anything.

Input coordinates are physical 0-indexed arrays (columns increase left->right);
across words read right->left, down words top->bottom. For Claude across entries
the c coordinate is the LEFTMOST occupied cell, unlike v3 starts.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from generate import normalize


def runs_in_grid(letters):
    n = len(letters)
    runs = {}
    singletons = 0
    for direction in ("A", "D"):
        for line in range(n):
            pos = n-1 if direction == "A" else 0
            while 0 <= pos < n:
                r, c = (line, pos) if direction == "A" else (pos, line)
                if not letters[r][c]:
                    pos += -1 if direction == "A" else 1
                    continue
                start = (direction, r, c)
                chars = []
                while 0 <= pos < n:
                    r, c = (line, pos) if direction == "A" else (pos, line)
                    if not letters[r][c]:
                        break
                    chars.append(letters[r][c])
                    pos += -1 if direction == "A" else 1
                if len(chars) == 1:
                    singletons += 1
                else:
                    runs[start] = "".join(chars)
    return runs, singletons


def convert(source, bank, *, max_black_fraction=0.30):
    payload = source.get("grid") or {}
    n = payload.get("size")
    letters = payload.get("letters")
    black = payload.get("black")
    if not isinstance(n,int) or n<2 or not isinstance(letters,list) or not isinstance(black,list):
        raise ValueError("grid.size, grid.black and grid.letters are required")
    if len(letters)!=n or len(black)!=n or any(
        not isinstance(row,list) or len(row)!=n for row in [*letters,*black]
    ):
        raise ValueError("Expected exact square arrays")
    for r in range(n):
        for c in range(n):
            if black[r][c] not in (0,1):
                raise ValueError(f"Invalid blocker value at {r},{c}")
            v=letters[r][c]
            if not isinstance(v,str) or (bool(v) == bool(black[r][c])):
                raise ValueError(f"Black and letters disagree at {r},{c}")
            if v and len(v)!=1:
                raise ValueError(f"Multiple characters in one cell at {r},{c}")

    allruns, singletons = runs_in_grid(letters)
    source_words={}
    for entry in payload.get("entries",[]):
        word=normalize(entry.get("word",""))
        direction=entry.get("dir")
        row,col=entry.get("r"),entry.get("c")
        if direction not in ("A","D") or not isinstance(row,int) or not isinstance(col,int):
            raise ValueError("Invalid source entry direction/coordinates")
        key=(direction,row,col+len(word)-1 if direction=="A" else col)
        if key in source_words:
            raise ValueError("Duplicate source entry position")
        if allruns.get(key)!=word:
            raise ValueError(f"Entry {word!r} does not match its full grid run")
        source_words[key]=word
    if source_words!=allruns:
        missing=set(allruns)-set(source_words)
        raise ValueError(f"Found {len(missing)} grid runs without documented entries")
    available={}
    for item in bank:
        word=normalize(item.get("answer",""))
        clue=str(item.get("clue","")).strip()
        if not word or not clue:
            continue
        if word not in available or (item.get("reviewed") and not available[word].get("reviewed")):
            available[word]=item
    missing_clues=sorted(set(allruns.values())-set(available))
    if missing_clues:
        raise ValueError(f"No original clue for {len(missing_clues)} answers in the local bank")

    grouped={"horizontal":{},"vertical":{}}
    across=sorted((key,word) for key,word in allruns.items() if key[0]=="A")
    down=sorted((key,word) for key,word in allruns.items() if key[0]=="D")
    # Sort RTL across (rightmost start first), top-down down.
    across.sort(key=lambda pair:(pair[0][1],-pair[0][2]))
    down.sort(key=lambda pair:(n-pair[0][2],pair[0][1]))
    for group,items in ((grouped["horizontal"],across),(grouped["vertical"],down)):
        for (direction,row,col),word in items:
            index=str(row+1 if direction=="A" else n-col)
            group.setdefault(index,[]).append(available[word]["clue"])

    blocks=sum(sum(row) for row in black)
    active_rows=sum(any(letters[r]) for r in range(n))
    active_cols=sum(any(letters[r][c] for r in range(n)) for c in range(n))
    ratio=blocks/(n*n)
    ready=(singletons==0 and ratio<=max_black_fraction
           and active_rows==n and active_cols==n)
    return {
        "version":3,
        "grid":letters,
        "clues":grouped,
        "meta":{"title":"پیش‌نویس واردشده از سازندهٔ واژه‌محور",
                "size":{"rows":n,"cols":n},"language":"fa",
                "direction":"rtl","status":"draft",
                "method":"claude-word-first-import"},
        "_draft":{"publication_ready":False,"strict_structure_pass":ready,
                  "maximal_words":len(allruns),"singleton_runs":singletons,
                  "black_cells":blocks,"black_fraction":round(ratio,4),
                  "active_rows":active_rows,"active_columns":active_cols,
                  "requires_editorial_review":True}
    }


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input",required=True,type=Path,help="Claude crossword_output.json")
    parser.add_argument("--bank",required=True,type=Path,help="Locally held jadval bank JSON")
    parser.add_argument("--output",required=True,type=Path,help="Draft JSON destination")
    parser.add_argument("--strict",action="store_true",help="Reject grids with singleton runs or excessive black cells")
    args=parser.parse_args()
    source=json.loads(args.input.read_text(encoding="utf-8"))
    raw_bank=json.loads(args.bank.read_text(encoding="utf-8"))
    entries=raw_bank.get("entries") if isinstance(raw_bank,dict) else raw_bank
    if not isinstance(entries,list):
        parser.error("Bank must be a list or an object with entries[]")
    result=convert(source,entries)
    if args.strict and not result["_draft"]["strict_structure_pass"]:
        parser.error("Source grid fails classic structure requirements; not exported")
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(result["_draft"],ensure_ascii=False))


if __name__=="__main__":
    main()
