#!/usr/bin/env python3
"""Persian crossword draft generator. Standard library only; no external puzzle data."""
import argparse
import json
import random
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent

def normalize(value):
    value = unicodedata.normalize("NFKC", str(value)).translate(str.maketrans({
        "ي": "ی", "ى": "ی", "ك": "ک", "ۀ": "ه", "ة": "ه",
        "أ": "ا", "إ": "ا", "آ": "آ"
    }))
    value = re.sub(r"[\u064b-\u065f\u0670\u200c\s\-]+", "", value)
    return "".join(ch for ch in value if ch.isalpha())

def load_entries(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data["entries"]
    result = []
    seen = set()
    for item in data:
        word = normalize(item.get("answer", ""))
        clue = str(item.get("clue", "")).strip()
        if not (2 <= len(word) <= 30 and clue) or (clue, word) in seen:
            continue
        seen.add((clue, word))
        result.append({**item, "word": word, "clue": clue})
    return result

def can_place(grid, word, row, col, dr, dc, occupancy=None):
    """Check intersections, boundary separation and same-direction ownership.

    occupancy (optional) maps 'across'/'down' to boolean grid matrices.
    The default keeps compatibility with older callers; generation passes it.
    """
    n = len(grid)
    before = (row-dr, col-dc)
    after = (row+len(word)*dr, col+len(word)*dc)
    for rr, cc in (before, after):
        if 0 <= rr < n and 0 <= cc < n and grid[rr][cc]:
            return False
    touches = 0
    for i, letter in enumerate(word):
        r, c = row+i*dr, col+i*dc
        if not (0 <= r < n and 0 <= c < n):
            return False
        old = grid[r][c]
        if old:
            if old != letter:
                return False
            if occupancy is not None:
                same_direction = "across" if dc else "down"
                if occupancy[same_direction][r][c]:
                    return False  # No second answer may reuse this orientation.
            touches += 1
        else:
            neighbors = [(r-1,c),(r+1,c)] if dc else [(r,c-1),(r,c+1)]
            if any(0 <= y < n and 0 <= x < n and grid[y][x] for y,x in neighbors):
                return False
    return touches

def place(grid, word, row, col, dr, dc, occupancy=None):
    direction = "across" if dc else "down"
    for i, letter in enumerate(word):
        r, c = row+i*dr, col+i*dc
        grid[r][c] = letter
        if occupancy is not None:
            occupancy[direction][r][c] = True

def generate(entries, size, seed):
    rng = random.Random(seed)
    grid = [["" for _ in range(size)] for _ in range(size)]
    occupancy = {
        "across": [[False]*size for _ in range(size)],
        "down": [[False]*size for _ in range(size)]
    }
    candidates = [e for e in entries if 2 <= len(e["word"]) <= size]
    rng.shuffle(candidates)
    # Prefer longer initial crossing anchors, but retain variety.
    candidates.sort(key=lambda e: -len(e["word"]))
    placements = []
    used_answers = set()
    for entry in candidates:
        w = entry["word"]
        if w in used_answers:
            continue
        positions = []
        if not placements:
            # Persian horizontal words progress from right to left.
            positions = [(size//2, min(size-1, (size+len(w))//2), 0, -1)]
        else:
            for old in placements:
                # Prefer perpendicular intersections with existing words.
                odr, odc = old["dr"], old["dc"]
                dr, dc = (1, 0) if odc else (0, -1)
                for i, ch in enumerate(w):
                    for j, other in enumerate(old["word"]):
                        if ch != other:
                            continue
                        y = old["row"]+j*odr
                        x = old["col"]+j*odc
                        positions.append((y-i*dr, x-i*dc, dr, dc))
        rng.shuffle(positions)
        scored = []
        for y,x,dr,dc in positions:
            intersects = can_place(grid,w,y,x,dr,dc,occupancy)
            if intersects is False:
                continue
            if placements and not intersects:
                continue
            # Higher crossing count; gently favor central placement.
            score = intersects*100 - abs(y-size//2)-abs(x-size//2)
            scored.append((score,y,x,dr,dc))
        if not scored:
            continue
        _,y,x,dr,dc = max(scored)
        place(grid,w,y,x,dr,dc,occupancy)
        placements.append({**entry,"row":y,"col":x,"dr":dr,"dc":dc})
        used_answers.add(w)
    horizontal, vertical = {}, {}
    for p in placements:
        if p["dc"]:
            key = str(p["row"]+1)
            horizontal.setdefault(key, []).append(p)
        else:
            # Vertical group indexed from rightmost column.
            key = str(size-p["col"])
            vertical.setdefault(key, []).append(p)
    clues = {"horizontal":{}, "vertical":{}}
    for key, group in horizontal.items():
        group.sort(key=lambda p:-p["col"])
        clues["horizontal"][key] = [p["clue"] for p in group]
    for key, group in vertical.items():
        group.sort(key=lambda p:p["row"])
        clues["vertical"][key] = [p["clue"] for p in group]
    diagnostics = audit_draft(grid, placements, occupancy)
    return {
        "version":3, "grid":grid, "clues":clues,
        "meta":{"title":f"جدول آزمایشی {size}×{size}", "size":{"rows":size,"cols":size},
                "language":"fa","direction":"rtl", "id":f"draft-{size}-{seed}",
                "status":"draft","method":"word-first-directional"},
        "_draft":{"seed":seed,"placed":len(placements),"available":len(candidates),
                  "publication_ready":False,
                  "audit":diagnostics,
                  "placements":[{"answer":p["word"],"clue":p["clue"],
                                 "row":p["row"],"col":p["col"],
                                 "direction":"across" if p["dc"] else "down"} for p in placements]}
    }

def audit_draft(grid, placements, occupancy):
    """Audit a word-first draft without claiming it is publishable.

    Every open letter must belong to a registered answer; every maximal run
    >=2 should exactly match a registered source answer and its orientation.
    Single-letter runs are reported because classic grids normally forbid them.
    """
    n = len(grid)
    actual = set()
    for p in placements:
        d = "across" if p["dc"] else "down"
        actual.add((d,p["row"],p["col"],p["word"]))
    unexpected = []
    singleton_runs = 0
    maximal_runs = 0
    for direction in ("across","down"):
        for line in range(n):
            pos = n-1 if direction == "across" else 0
            while 0 <= pos < n:
                r,c = (line,pos) if direction=="across" else (pos,line)
                if not grid[r][c]:
                    pos += -1 if direction=="across" else 1
                    continue
                start_r,start_c = r,c
                letters = []
                while 0 <= pos < n:
                    r,c = (line,pos) if direction=="across" else (pos,line)
                    if not grid[r][c]:
                        break
                    letters.append(grid[r][c])
                    pos += -1 if direction=="across" else 1
                if len(letters)==1:
                    singleton_runs += 1
                else:
                    maximal_runs += 1
                    word = "".join(letters)
                    if (direction,start_r,start_c,word) not in actual:
                        unexpected.append({"direction":direction,"row":start_r,
                                           "col":start_c,"word":word})
    letter_cells=sum(bool(ch) for row in grid for ch in row)
    uncovered=sum(bool(grid[r][c]) and not (
        occupancy["across"][r][c] or occupancy["down"][r][c])
        for r in range(n) for c in range(n))
    active_rows=sum(any(row) for row in grid)
    active_cols=sum(any(grid[r][c] for r in range(n)) for c in range(n))
    blocks=n*n-letter_cells
    strictly_valid=(not unexpected and singleton_runs==0 and uncovered==0
                     and active_rows==n and active_cols==n)
    return {
        "size":n,"letter_cells":letter_cells,"black_cells":blocks,
        "black_fraction":round(blocks/(n*n),4),
        "maximal_runs":maximal_runs,"singleton_runs":singleton_runs,
        "unexpected_runs":unexpected,"uncovered_letters":uncovered,
        "active_rows":active_rows,"active_columns":active_cols,
        "structure_valid":strictly_valid,
        "meets_30_percent_black_target":blocks/(n*n)<=0.30
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",default=str(HERE/"sample.json"))
    parser.add_argument("--size",type=int,default=15)
    parser.add_argument("--count",type=int,default=3)
    parser.add_argument("--seed",type=int,default=2026)
    args=parser.parse_args()
    if not 5 <= args.size <= 35:
        parser.error("size must be between 5 and 35")
    if not 1 <= args.count <= 100:
        parser.error("count must be between 1 and 100")
    entries=load_entries(args.input)
    out=HERE/"output"
    out.mkdir(parents=True,exist_ok=True)
    for i in range(args.count):
        puzzle=generate(entries,args.size,args.seed+i)
        path=out/f"draft-{args.size}-{args.seed+i}.json"
        path.write_text(json.dumps(puzzle,ensure_ascii=False,indent=2),encoding="utf-8")
        print(f"{path}: {puzzle['_draft']['placed']} entries")
if __name__=="__main__":
    main()
