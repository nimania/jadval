#!/usr/bin/env python3
"""Stage Abadis clue/answer PAIRS in batches of up to 1000, without bank writes.

A repeated ANSWER with a different CLUE is a new valid pair. Only identical
normalized (clue,answer) combinations and repeated row IDs are duplicates.
All outputs stay private until the owner separately imports them to Google Sheets.
"""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

HEADERS = [
    'شناسه','پاسخ نرمال','پاسخ نمایشی','تعداد حروف','سرنخ',
    'دسته','درجه دشواری','وضعیت','نوع رکورد','شناسه منبع',
    'پیوند منبع','مجوز','تأیید مستند','یادداشت سردبیر',
    'بازبین','تاریخ بررسی','وضعیت سرنخ'
]
TRANSLATION = str.maketrans({
    'ي':'ی','ى':'ی','ك':'ک','ة':'ه','ۀ':'ه','أ':'ا','إ':'ا','آ':'ا'
})

def norm(s):
    s=unicodedata.normalize('NFKC',str(s or '')).translate(TRANSLATION)
    s=re.sub(r'[\u064b-\u065f\u0670\u0640\u200c\u200d\s\-]+','',s)
    return ''.join(c for c in s if c.isalpha())

def display_clue(s):
    # Never swap Persian word order or silently rewrite a source clue.
    return ' '.join(str(s or '').split())

def read_rows(path):
    with open(path,encoding='utf-8-sig',newline='') as f:
        yield from csv.DictReader(f)

def prepare(items,existing_main,existing_review,run_id):
    """Pure pair-based merge classification; repeated answers are not discarded."""
    keys=set()
    ids=set()
    old_answers=set()
    for row in list(existing_main)+list(existing_review):
        answer=norm(row.get('پاسخ نرمال',''))
        clue=norm(row.get('سرنخ',''))
        if answer: old_answers.add(answer)
        if clue and answer:keys.add((clue,answer))
        if row.get('شناسه'):ids.add(row['شناسه'])
    main=[];review=[];dupes=[];counter=Counter()
    answer_to_clues=defaultdict(set)
    new_answer_count=0; new_clue_for_old_answer_count=0
    for i,x in enumerate(items):
        raw=str(x.get('raw_clue') or x.get('source_clue_raw') or x.get('clue') or '')
        clue=display_clue(raw)
        answer=norm(x.get('answer',''))
        key=(norm(clue),answer)
        rid=x.get('id') or ('abadis-pair-'+hashlib.sha256(('\n'.join(key)).encode()).hexdigest()[:24])
        if not key[0] or not key[1]:
            dupes.append({'id':rid,'reason':'invalid_pair','clue':clue,'answer':answer})
            continue
        if key in keys or rid in ids:
            dupes.append({'id':rid,'reason':'duplicate_exact_pair_or_id','clue':clue,'answer':answer})
            continue
        # Crucial: do NOT deduplicate by answer; each different clue remains.
        keys.add(key); ids.add(rid)
        if answer in old_answers:new_clue_for_old_answer_count+=1
        else:new_answer_count+=1
        answer_to_clues[answer].add(key[0])
        flags=list(x.get('quality_flags') or [])
        if any(len(token)==1 and token!='و' for token in clue.split()):
            flags.append('broken_clue_spacing')
        if len(clue)>110:flags.append('long_clue')
        if not 2<=len(answer)<=30:flags.append('invalid_answer_length')
        if norm(clue)==answer:flags.append('answer_equals_clue')
        display=str(x.get('display_answer') or x.get('answer') or '')
        if len(display.split())>1:flags.append('multiword_answer')
        if display.strip().endswith(('.',',','،','؛')):flags.append('answer_punctuation')
        source_url=str(x.get('source_url') or '')
        if not source_url.startswith('https://abadis.ir/fatofa/'):
            flags.append('invalid_source_url')
        flags=list(dict.fromkeys(flags))
        counter.update(flags)
        notes=(f"سرنخ خام: {raw} | پرچم‌ها: {','.join(flags) or 'ندارد'} | "
               f"صفحه: {x.get('source_page','?')} | اندیس: {x.get('source_index','?')} | "
               f"اجرای GitHub: {run_id}")
        row=[rid,answer,display,len(answer),clue,
             'دسته‌بندی‌نشده','unknown','در انتظار بازبینی',
             'سؤال‌وجواب آبادیس','abadis-full-scan-'+str(run_id),source_url,
             'آبادیس؛ ذکر منبع الزامی','تأیید محتوایی نشده',notes,'','',
             'نیازمند اصلاح/تأیید' if flags else 'در انتظار بررسی']
        (review if flags else main).append(row)
    metrics={
        'new_pairs':len(main)+len(review),
        'structurally_eligible':len(main),'quarantine':len(review),
        'duplicate_or_invalid':len(dupes),
        'new_pairs_using_existing_answers':new_clue_for_old_answer_count,
        'candidate_answers_not_in_previous_bank':new_answer_count,
        'distinct_answers_in_new_pairs':len(answer_to_clues),
        'answers_with_multiple_new_clues':sum(len(v)>1 for v in answer_to_clues.values()),
        'flags':dict(counter)
    }
    return main,review,dupes,metrics

def csv_file(path,rows):
    with open(path,'w',newline='',encoding='utf-8-sig') as f:
        w=csv.writer(f);w.writerow(HEADERS);w.writerows(rows)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--main',required=True,help='private canonical bank export CSV')
    ap.add_argument('--review',required=True,nargs='+',help='private review queue exports')
    ap.add_argument('--artifact',required=True,nargs='+',help='one or more Abadis JSON artifact files')
    ap.add_argument('--out-prefix',required=True)
    ap.add_argument('--run-id',default='unknown')
    ap.add_argument('--batch-size',type=int,default=1000)
    args=ap.parse_args()
    if not 1<=args.batch_size<=1000:ap.error('batch-size must be 1..1000')
    source_items=[]
    for path in args.artifact:
        obj=json.loads(Path(path).read_text('utf-8'))
        if obj.get('source') not in ('https://abadis.ir','https://abadis.ir/crossword/'):
            ap.error('Unrecognized source in '+path)
        source_items.extend(obj.get('items',[]))
    existing_main=list(read_rows(args.main))
    existing_review=[r for p in args.review for r in read_rows(p)]
    main_rows,review_rows,dup,metrics=prepare(
        source_items,existing_main,existing_review,args.run_id)
    prefix=Path(args.out_prefix)
    prefix.parent.mkdir(parents=True,exist_ok=True)
    outputs={}
    for label,rows in [('main',main_rows),('review',review_rows)]:
        outputs[label]=[]
        if len(rows)<=args.batch_size:
            path=str(prefix)+'-'+label+'.csv'
            csv_file(path,rows);outputs[label].append(path)
        else:
            for i in range(0,len(rows),args.batch_size):
                path=f'{prefix}-{label}-{i//args.batch_size+1:03d}.csv'
                csv_file(path,rows[i:i+args.batch_size]);outputs[label].append(path)
    report={'run_id':args.run_id,'source_count':len(source_items),
            'previous_pairs_in_main':len(existing_main),
            'previous_pairs_in_review':len(existing_review),
            'batch_size':args.batch_size,'metrics':metrics,
            'outputs':outputs,'duplicates_sample':dup[:10],
            'note':'Pairs are unique by normalized clue+answer, NOT by answer alone. Files do not change the live bank.'}
    Path(str(prefix)+'-report.json').write_text(
        json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
