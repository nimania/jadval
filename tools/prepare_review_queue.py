#!/usr/bin/env python3
"""Create an editorial review queue from unapproved crossword candidates.

No candidates are approved or added to the production bank by this script.
"""
import argparse
import csv
from collections import defaultdict, deque
import json
from pathlib import Path

LENGTH_QUOTAS = [(3,12),(4,18),(5,25),(6,20),(7,15),(8,7),(9,3)]
FIELDS = [
    'candidate_id','answer','answer_display','letters','clue_proposal',
    'category','review_decision','verified_meaning','evidence_url',
    'reviewer_notes','source_id','source_url','license'
]

def load_candidates(path):
    result = []
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        if line.strip():
            entry = json.loads(line)
            if entry.get('status') != 'needs_review' or entry.get('reviewed') is not False:
                raise ValueError('Input contains a record that is already approved or has unexpected status')
            if len(entry.get('answer','')) != entry.get('letters'):
                raise ValueError('Candidate answer-length mismatch')
            result.append(entry)
    return result

def distribute(items, limit):
    """Choose length-balanced, initial-letter-diverse candidates deterministically."""
    by_answer = {}
    for entry in items:
        by_answer.setdefault(entry['answer'],entry)
    groups = defaultdict(list)
    for entry in by_answer.values():
        length = entry['letters']
        target = length if length <= 8 else 9
        groups[(target,entry['answer'][0])].append(entry)
    for group in groups.values():group.sort(key=lambda item:item['answer'])
    buckets = defaultdict(deque)
    for (length,initial),group in sorted(groups.items(),key=lambda x:x[0]):
        buckets[length].append((initial,deque(group)))
    result, seen = [], set()
    proportions = {key:share for key,share in LENGTH_QUOTAS}
    slots = {key:round(limit*share/100) for key,share in LENGTH_QUOTAS}
    def take(length):
        queue=buckets[length]
        while queue:
            initial,group=queue.popleft()
            item=group.popleft()
            if group:queue.append((initial,group))
            if item['answer'] not in seen:
                seen.add(item['answer'])
                return item
        return None
    for length,_ in LENGTH_QUOTAS:
        for _ in range(slots[length]):
            item=take(length)
            if item is None:break
            result.append(item)
    while len(result)<limit:
        added=False
        for length,_ in LENGTH_QUOTAS:
            item=take(length)
            if item is not None:
                result.append(item)
                added=True
            if len(result)>=limit:break
        if not added:break
    return result[:limit],len(by_answer)

def make_report(records,total_distinct):
    counts=defaultdict(int)
    for e in records: counts[str(e['letters'])]+=1
    return {
        'selected_for_review':len(records),
        'distinct_input_answers':total_distinct,
        'counts_by_length':dict(sorted(counts.items(),key=lambda x:int(x[0]))),
        'reviewed_or_approved':0,
        'warning':'Queue only. Completion of a review decision is not a production import.'
    }

def run(args):
    if args.limit < 1:raise ValueError('Limit must be positive')
    source=Path(args.input); output=Path(args.output)
    if output.exists() or output.with_suffix('.report.json').exists():
        raise FileExistsError('Output already exists; choose another path.')
    if source.resolve()==output.resolve(): raise ValueError('Input and output must differ.')
    selected,total=distribute(load_candidates(source),args.limit)
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=FIELDS)
        writer.writeheader()
        for e in selected:
            writer.writerow({
                'candidate_id':e['candidate_id'],
                'answer':e['answer'],
                'answer_display':e['answer_display'],
                'letters':e['letters'],
                'clue_proposal':e.get('clue') or '',
                'category':e.get('category') or 'دسته‌بندی‌نشده',
                'review_decision':'در انتظار',
                'verified_meaning':'','evidence_url':'','reviewer_notes':'',
                'source_id':e['source_id'],'source_url':e['source_url'],
                'license':e['license']
            })
    report=make_report(selected,total)
    output.with_suffix('.report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',required=True)
    p.add_argument('--output',required=True)
    p.add_argument('--limit',type=int,default=1500)
    run(p.parse_args())
