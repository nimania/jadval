#!/usr/bin/env python3
"""Deduplicate a bounded Abadis artifact against private Google Sheets CSV snapshots.

Only writes LOCAL staging CSVs and a report. Never updates live bank or GitHub.
Use with private bank exports outside the public repository. All admitted entries
are UNREVIEWED; structural acceptance is not editorial verification.
"""
import argparse,csv,difflib,json,re,unicodedata
from collections import defaultdict,Counter
from pathlib import Path

HEADERS=['شناسه','پاسخ نرمال','پاسخ نمایشی','تعداد حروف','سرنخ',
 'دسته','درجه دشواری','وضعیت','نوع رکورد','شناسه منبع','پیوند منبع',
 'مجوز','تأیید مستند','یادداشت سردبیر','بازبین','تاریخ بررسی','وضعیت سرنخ']

def norm(s):
 s=unicodedata.normalize('NFKC',str(s)).translate(str.maketrans(
  {'ي':'ی','ى':'ی','ك':'ک','ة':'ه','ۀ':'ه','أ':'ا','إ':'ا','آ':'ا'}))
 return ''.join(c for c in re.sub(r'[\u064b-\u065f\u0670\u0640\u200c\u200d\s\-]+','',s) if c.isalpha())
def clue_fix(s):
 s=' '.join(str(s).split())
 for a,b in [('ائینه','آینه'),('ائینی','آیینی'),('ائین','آیین'),('اب','آب')]:
  if s==a or s.startswith(a+' '):return b+s[len(a):]
 return s
def csv_rows(path):
 with open(path,encoding='utf-8-sig',newline='') as f:
  yield from csv.DictReader(f)
def out_csv(path,rows):
 with open(path,'w',encoding='utf-8-sig',newline='') as f:
  w=csv.writer(f);w.writerow(HEADERS);w.writerows(rows)

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--main',required=True,help='private central bank CSV')
 ap.add_argument('--review',required=True,nargs='+',help='one or more private review CSVs')
 ap.add_argument('--artifact',required=True,help='JSON from completed Abadis crawler')
 ap.add_argument('--out-prefix',required=True)
 ap.add_argument('--run-id',default='unknown')
 a=ap.parse_args()
 art=json.loads(Path(a.artifact).read_text('utf-8'))
 if art.get('source') not in ('https://abadis.ir','https://abadis.ir/crossword/'):
  raise SystemExit('Unexpected extraction source')
 keys=set();by_answer=defaultdict(list);ids=set()
 for p in [a.main]+a.review:
  for r in csv_rows(p):
   clue,answer=r.get('سرنخ',''),r.get('پاسخ نرمال','')
   k=(norm(clue),norm(answer))
   if k[0] and k[1]:keys.add(k);by_answer[k[1]].append(k[0])
   if r.get('شناسه'):ids.add(r['شناسه'])
 admitted=[];quarantine=[];dupes=[];flags_counter=Counter()
 for x in art['items']:
  raw=str(x.get('raw_clue') or x.get('source_clue_raw') or x.get('clue') or '')
  clue=clue_fix(raw)
  answer=norm(x.get('answer',''))
  key=(norm(clue),answer)
  if key in keys or x.get('id') in ids:
   dupes.append({'clue':clue,'answer':answer,'reason':'same_pair_or_id'})
   continue
  keys.add(key);by_answer[answer].append(key[0])
  flags=list(x.get('quality_flags') or [])
  if any(len(t)==1 and t!='و' for t in clue.split()):flags.append('split_character')
  if len(clue)>110:flags.append('long_clue')
  if not (2<=len(answer)<=30):flags.append('answer_length')
  if re.search(r'[0-9۰-۹:!?؟]',clue):flags.append('unusual_clue_punctuation')
  if len(str(x.get('display_answer','')).split())>1:flags.append('multiword_answer')
  if str(x.get('display_answer','')).strip().endswith(('.',',','،','؛')):flags.append('answer_punctuation')
  existing=by_answer.get(answer,[])
  # near-duplicate clue with same answer is not a useful new pair
  if any(other!=key[0] and difflib.SequenceMatcher(None,key[0],other).ratio()>.92
         for other in existing):flags.append('near_duplicate_same_answer')
  flags=list(dict.fromkeys(flags))
  flags_counter.update(flags)
  source=str(x.get('source_url',''))
  if not source.startswith('https://abadis.ir/fatofa/'):flags.append('bad_source_url')
  notes=f"خام: {raw} | پرچم‌ها: {','.join(flags) or 'ندارد'} | صفحه: {x.get('source_page','?')} | اندیس: {x.get('source_index','?')} | اجرای GitHub: {a.run_id}"
  row=[x.get('id',''),answer,x.get('display_answer',answer),len(answer),clue,
    'دسته‌بندی‌نشده','unknown','در انتظار بازبینی','سؤال‌وجواب آبادیس',
    'abadis-full-scan-'+a.run_id,source,'آبادیس؛ ذکر منبع الزامی',
    'تأیید محتوایی نشده',notes,'','',
    'نیازمند بررسی سرنخ/پاسخ' if flags else 'در انتظار بررسی']
  (quarantine if flags else admitted).append(row)
 prefix=Path(a.out_prefix);prefix.parent.mkdir(parents=True,exist_ok=True)
 out_csv(str(prefix)+'-main.csv',admitted)
 out_csv(str(prefix)+'-review.csv',quarantine)
 report={'run_id':a.run_id,'source_count':len(art['items']),
  'new_structurally_accepted':len(admitted),'new_review':len(quarantine),
  'duplicates':len(dupes),'flags':dict(flags_counter),
  'next_cursor':art.get('next_cursor'),'source_status':art.get('meta',{}).get('status'),
  'notes':'All candidates unreviewed. This tool does not update Google Sheets.'}
 Path(str(prefix)+'-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
 print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
