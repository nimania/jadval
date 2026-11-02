#!/usr/bin/env python3
"""Stage Persian crossword candidates for editorial review (never publish)."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import csv
import hashlib
import json
from pathlib import Path
import re
import unicodedata

REJECT_DIACRITICS = re.compile(r'[\u064b-\u065f\u0670\u0640]')
REMOVE_SEPARATORS = re.compile(r'[\s\u200c\u200d\-]+')
ALLOWED = re.compile(r'^[\u0621-\u063a\u0641-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc\u0622]+$')
TRANSLATION = str.maketrans({'ي':'ی', 'ى':'ی', 'ك':'ک'})

def normalize(word):
    word = unicodedata.normalize('NFKC', str(word)).translate(TRANSLATION)
    return REMOVE_SEPARATORS.sub('', REJECT_DIACRITICS.sub('',word))

def valid_answer(answer, min_letters=3, max_letters=20):
    return bool(ALLOWED.fullmatch(answer)) and min_letters <= len(answer) <= max_letters

def read_json_or_jsonl(path):
    text = Path(path).read_text(encoding='utf-8-sig')
    if path.suffix == '.jsonl':
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    obj = json.loads(text)
    return obj.get('entries', []) if isinstance(obj, dict) else obj

def stable_id(answer, clue=''):
    return 'candidate-' + hashlib.sha256((answer + '\n' + clue).encode('utf-8')).hexdigest()[:24]

def load_pairs(path):
    if path.suffix == '.csv':
        with path.open(encoding='utf-8-sig', newline='') as f:
            return list(csv.DictReader(f))
    return read_json_or_jsonl(path)

def create_records(rows, kind, source, source_url, license_name, min_letters, max_letters):
    seen, items, rejects, duplicates = set(), [], Counter(), 0
    for row in rows:
        if kind == 'words':
            raw, clue, category = str(row).strip(), None, 'دسته‌بندی‌نشده'
        else:
            if not isinstance(row,dict):
                rejects['invalid-record'] += 1
                continue
            raw = str(row.get('answer') or '').strip()
            clue = str(row.get('clue') or '').strip() or None
            category = str(row.get('category') or 'دسته‌بندی‌نشده')
            if not clue:
                rejects['missing-clue'] += 1
                continue
        word = normalize(raw)
        if not valid_answer(word, min_letters, max_letters):
            rejects['invalid-answer-or-length'] += 1
            continue
        key = (word,clue)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        items.append({
            'candidate_id':stable_id(word,clue or ''), 'answer':word,
            'answer_display':raw, 'letters':len(word), 'clue':clue,
            'category':category, 'difficulty':'unknown', 'status':'needs_review',
            'reviewed':False, 'source_id':source, 'source_url':source_url,
            'license':license_name,
            'source_kind':'wordlist' if kind=='words' else 'question_answer',
            'verification':'not_verified',
            'notes':'Requires review of answer, sense, clue and rights before approval.'
        })
    return items,rejects,duplicates

def load_existing_answers(path):
    if path is None:return set()
    return {normalize(item.get('answer','')) for item in load_pairs(path)
            if isinstance(item,dict) and item.get('answer')}

def build_report(items,rejected,duplicates,existing_answers):
    answers = {x['answer'] for x in items}
    lengths = Counter(len(x) for x in answers)
    pairs = Counter(x['answer'] for x in items if x['clue'])
    return {
        'version':1, 'created_at_utc':datetime.now(timezone.utc).isoformat(),
        'candidate_records':len(items), 'distinct_answers':len(answers),
        'draft_clues':sum(bool(x['clue']) for x in items),
        'overlap_with_existing_answers':len(answers & existing_answers),
        'new_answers_vs_existing':len(answers-existing_answers),
        'existing_answers_count':len(existing_answers),
        'counts_by_length':{str(k):v for k,v in sorted(lengths.items())},
        'answers_with_multiple_clues':sum(n>1 for n in pairs.values()),
        'duplicates_removed':duplicates, 'rejections':dict(rejected),
        'production_approved':0,
        'warning':'Never auto-sync staging candidates to Firestore or publish them.'
    }

def run(args):
    if not args.source_id or not args.license:
        raise ValueError('Source and license are mandatory.')
    source=Path(args.input)
    output=Path(args.output)
    report_file=output.with_suffix('.report.json')
    if output.resolve()==source.resolve():
        raise ValueError('Output must be different from input')
    if not args.overwrite and (output.exists() or report_file.exists()):
        raise FileExistsError('Staging output exists. Use a new path or --overwrite.')
    rows=(source.read_text(encoding='utf-8-sig').splitlines()
          if args.mode=='words' else load_pairs(source))
    items,rejected,duplicates=create_records(
        rows,args.mode,args.source_id,args.source_url,args.license,
        args.min_letters,args.max_letters)
    existing=load_existing_answers(Path(args.existing)) if args.existing else set()
    stats=build_report(items,rejected,duplicates,existing)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(''.join(json.dumps(x,ensure_ascii=False,sort_keys=True)+'\n'
                              for x in items),encoding='utf-8')
    report_file.write_text(json.dumps(stats,ensure_ascii=False,indent=2),
                           encoding='utf-8')
    print(json.dumps({'data':str(output),'report':str(report_file),**stats},
                     ensure_ascii=False,indent=2))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode',choices=['words','pairs'])
    parser.add_argument('--input',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--existing',help='Optional private bank export (read-only)')
    parser.add_argument('--source-id',required=True)
    parser.add_argument('--source-url',default='')
    parser.add_argument('--license',required=True)
    parser.add_argument('--min-letters',type=int,default=3)
    parser.add_argument('--max-letters',type=int,default=20)
    parser.add_argument('--overwrite',action='store_true')
    args=parser.parse_args()
    if not 1<=args.min_letters<=args.max_letters<=30:
        parser.error('Invalid length boundaries')
    run(args)

if __name__=='__main__':
    main()
