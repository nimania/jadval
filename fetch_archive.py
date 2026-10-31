#!/usr/bin/env python3
"""Download a licensed public PersianCrossword catalog via Firestore REST API.

Uses Firebase's published catalog/index and puzzlePacks/{id}. Does not modify
the source application or database. Fail closed if any pack is missing.
"""
import argparse
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "persiancrossword"
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"

def decode_firestore(value):
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return value["doubleValue"]
    if "booleanValue" in value:
        return value["booleanValue"]
    if "nullValue" in value:
        return None
    if "mapValue" in value:
        return {k: decode_firestore(v) for k, v in value["mapValue"].get("fields", {}).items()}
    if "arrayValue" in value:
        return [decode_firestore(v) for v in value["arrayValue"].get("values", [])]
    raise ValueError("unsupported Firestore field")

def read_doc(path, api_key, retries=3):
    url = BASE + "/" + path + "?" + urllib.parse.urlencode({"key": api_key})
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"JadvalStudio/0.1"})
            with urllib.request.urlopen(request, timeout=40) as response:
                data = json.load(response)
            return {k: decode_firestore(v) for k, v in data.get("fields", {}).items()}
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt + 1 == retries:
                raise RuntimeError(f"Firestore read failed: {path}: {exc}") from exc
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")

def safe_name(value):
    if not isinstance(value, str) or not value or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in value):
        raise ValueError(f"unsafe id: {value!r}")
    return value

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",default="archive/raw",help="Local output path; never push to public hosting directly")
    parser.add_argument("--api-key",default=os.getenv("CROSSWORD_FIREBASE_API_KEY",""))
    args = parser.parse_args()
    if not args.api_key:
        parser.error("Set CROSSWORD_FIREBASE_API_KEY in GitHub Actions secrets or --api-key")
    catalog = read_doc("catalog/index",args.api_key)
    if catalog.get("schema") != 2:
        raise RuntimeError("Unexpected catalog schema (expected 2)")
    packs = catalog.get("packs")
    if not isinstance(packs,dict) or not packs:
        raise RuntimeError("Empty catalog; refusing to overwrite any archive")
    base = pathlib.Path(args.output)
    base.mkdir(parents=True,exist_ok=True)
    count=0
    fetched=[]
    # Store one puzzle per JSON, keeping source identifiers and metadata.
    # Repeated runs overwrite exact ids and preserve other archive files.
    for pack_id in sorted(packs):
        pack_id = safe_name(pack_id)
        pack = read_doc(f"puzzlePacks/{pack_id}",args.api_key)
        if pack.get("schema")!=2:
            raise RuntimeError(f"Pack schema mismatch: {pack_id}")
        expected_hash=packs[pack_id].get("hash")
        if expected_hash and pack.get("hash")!=expected_hash:
            raise RuntimeError(f"Pack modified during snapshot: {pack_id}; run again")
        puzzle_entries=pack.get("puzzles")
        if not isinstance(puzzle_entries,dict):
            raise RuntimeError(f"Unreadable pack: {pack_id}")
        for puzzle_id, item in puzzle_entries.items():
            puzzle_id=safe_name(puzzle_id)
            if not isinstance(item,dict) or not isinstance(item.get("json"),str):
                raise RuntimeError(f"Missing puzzle JSON: {puzzle_id}")
            puzzle=json.loads(item["json"])
            if puzzle.get("version")!=3 or not isinstance(puzzle.get("grid"),list):
                raise RuntimeError(f"Invalid v3 puzzle: {puzzle_id}")
            # Namespaced by ID, not source file path, to avoid traversal.
            dest=base/(puzzle_id+".json")
            dest.write_text(json.dumps(puzzle,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            count+=1
        fetched.append({"pack":pack_id,"puzzles":len(puzzle_entries)})
        print(f"{pack_id}: {len(puzzle_entries)}")
    manifest={"source":PROJECT,"source_schema":2,"packs":fetched,"puzzle_count":count,
              "source_catalog_updated_at":catalog.get("updatedAt")}
    (base/"_manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Downloaded {count} puzzles in {len(fetched)} packs to {base}")

if __name__=="__main__":
    main()
