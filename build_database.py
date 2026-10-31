#!/usr/bin/env python3
"""Build a searchable, provenance-preserving SQLite question-answer bank."""
import argparse
import json
import sqlite3
from pathlib import Path
from generate import normalize

DDL = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS puzzles (
  puzzle_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  newspaper TEXT,
  original_date TEXT,
  rows INTEGER NOT NULL,
  cols INTEGER NOT NULL,
  source_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  entry_id TEXT PRIMARY KEY,
  clue TEXT NOT NULL,
  answer TEXT NOT NULL,
  letters INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'دسته‌بندی‌نشده',
  difficulty TEXT NOT NULL DEFAULT 'unknown',
  reviewed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(clue, answer)
);
CREATE TABLE IF NOT EXISTS occurrences (
  puzzle_id TEXT NOT NULL REFERENCES puzzles(puzzle_id),
  entry_id TEXT NOT NULL REFERENCES entries(entry_id),
  direction TEXT NOT NULL,
  PRIMARY KEY (puzzle_id, entry_id, direction)
);
CREATE INDEX IF NOT EXISTS ix_entries_answer ON entries(answer);
CREATE INDEX IF NOT EXISTS ix_entries_category ON entries(category);
"""

def main():
    from import_puzzles import extract
    p=argparse.ArgumentParser()
    p.add_argument("--archive", default="archive/raw")
    p.add_argument("--db", default="archive/jadval.sqlite")
    p.add_argument("--report", default="archive/report.json")
    args=p.parse_args()
    source=Path(args.archive)
    files=sorted(f for f in source.glob("*.json") if not f.name.startswith("_"))
    if not files: raise SystemExit("No puzzle files; refusing to build an empty database")
    dbpath=Path(args.db);dbpath.parent.mkdir(parents=True,exist_ok=True)
    con=sqlite3.connect(dbpath)
    con.executescript(DDL)
    bad=[]
    for f in files:
        try:
            raw=f.read_text(encoding="utf-8")
            puzzle=json.loads(raw)
            meta=puzzle.get("meta",{})
            puzzle_id=str(meta.get("id") or f.stem)
            extracted=list(extract(puzzle))
            with con:
                con.execute("INSERT OR REPLACE INTO puzzles VALUES (?,?,?,?,?,?,?)",(
                    puzzle_id,str(meta.get("title") or puzzle_id),str(meta.get("newspaper") or ""),
                    str(meta.get("publishedAt") or ""),len(puzzle["grid"]),len(puzzle["grid"][0]),raw))
                for clue,answer,direction in extracted:
                    import hashlib
                    entry_id=hashlib.sha256((clue+"\n"+answer).encode()).hexdigest()[:20]
                    con.execute("INSERT OR IGNORE INTO entries (entry_id,clue,answer,letters) VALUES (?,?,?,?)",
                                (entry_id,clue,normalize(answer),len(normalize(answer))))
                    con.execute("INSERT OR IGNORE INTO occurrences VALUES (?,?,?)",(puzzle_id,entry_id,direction))
        except (ValueError,KeyError,TypeError,sqlite3.Error,json.JSONDecodeError) as exc:
            bad.append({"file":f.name,"error":str(exc)})
    counts={key:con.execute("SELECT COUNT(*) FROM "+key).fetchone()[0] for key in ("puzzles","entries","occurrences")}
    report={"source_files":len(files),**counts,"invalid_files":bad}
    Path(args.report).parent.mkdir(parents=True,exist_ok=True)
    Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    con.close()
    print(json.dumps({k:v for k,v in report.items() if k!="invalid_files"},ensure_ascii=False))
    if bad: raise SystemExit(f"{len(bad)} invalid puzzle files; see {args.report}")

if __name__=="__main__": main()
