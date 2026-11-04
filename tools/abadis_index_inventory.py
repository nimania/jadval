#!/usr/bin/env python3
"""Bounded Abadis index inventory + small stratified sample; no bank writes.

Counts exact only when last indexed page is discoverable within the page cap.
All extracted clue/answer pairs are candidates requiring editorial review.
"""
import argparse, json, time, re, unicodedata, hashlib, sys
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.robotparser import RobotFileParser
from abadis_sample import SITE, UA, get, parse_listing, parse_answer, word, comparable

ALPHABET=list('ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی')
def clean_clue(s):
 return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC',s)).strip()
def should_hold_answer(ans,clue):
 if not ans or len(ans)<2 or len(ans)>30:return 'invalid_answer_length'
 if comparable(ans)==comparable(clue):return 'answer_equals_clue'
 if len(ans)>=6 and len(ans)%2==0 and ans[:len(ans)//2]==ans[len(ans)//2:]:return 'possible_duplicated_answer'
 if not all(c.isalpha() for c in ans):return 'invalid_answer_letters'
 return None
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--group',type=int,required=True,choices=range(4))
 p.add_argument('--max-page',type=int,default=128)
 p.add_argument('--per-letter',type=int,default=6)
 p.add_argument('--delay',type=float,default=1.4)
 p.add_argument('--out',required=True)
 a=p.parse_args()
 if a.max_page>128 or a.max_page<10 or a.per_letter>8 or a.per_letter<1 or a.delay<1.2:raise SystemExit('Unsafe request budget')
 letters=ALPHABET[a.group*8:(a.group+1)*8]
 rp=RobotFileParser();rp.set_url(SITE+'/robots.txt');rp.read()
 if not (rp.can_fetch(UA,SITE+'/crossword/?ch=%D8%A7') and rp.can_fetch(UA,SITE+'/fatofa/test/')):
  raise SystemExit('No robots permission: stopping')
 rows=[]; candidates=[]; issues=[]; seen=set(); total_requests=0
 def fetch_index(letter,page,cache):
  nonlocal total_requests
  if page in cache:return cache[page]
  url=SITE+'/crossword/?ch='+quote(letter)+(('&pn='+str(page)) if page>1 else '')
  if not rp.can_fetch(UA,url):raise PermissionError('Index page disallowed')
  html=get(url,a.delay);total_requests+=1
  links=parse_listing(html)
  # Do not mistake out-of-range repeat of the first page for a valid page.
  if page>1 and links and 1 in cache and links[0][1]==cache[1][0][1]:
   links=[]
  cache[page]=links
  return links
 for letter in letters:
  cache={}; exact=False; count=None; lower=0; problem=None
  try:
   first=fetch_index(letter,1,cache)
   if not first:
    count=0;exact=True;last=0
   else:
    valid=1;invalid=None;probe=2
    while probe<=a.max_page:
     links=fetch_index(letter,probe,cache)
     if links:valid=probe;probe*=2
     else:invalid=probe;break
    if invalid is None:
     last=valid;lower=(valid-1)*50+len(cache[valid])
    else:
     lo,hi=valid,invalid
     while hi-lo>1:
      mid=(lo+hi)//2
      if fetch_index(letter,mid,cache):lo=mid
      else:hi=mid
     last=lo
     count=(last-1)*50+len(fetch_index(letter,last,cache))
     lower=count;exact=True
   rows.append({'letter':letter,'last_page_found':last,'count':count,'lower_bound':lower,'exact':exact,'probed_pages':sorted(cache)})
   if count is None and first:rows[-1]['note']='more pages may exist above max-page'
   # Capture 3 from first and 3 from a later page to reduce first-page bias.
   page_pool=[(1,first)]
   later=min(10,last)
   if later>1:
    page_pool.append((later,fetch_index(letter,later,cache)))
   per=(a.per_letter+len(page_pool)-1)//len(page_pool)
   for pg,links in page_pool:
    for clue,url in links[:per]:
     if url in seen:continue
     seen.add(url)
     if not rp.can_fetch(UA,url):continue
     try:
      html=get(url,a.delay);total_requests+=1
      raw=parse_answer(html,clue);ans=word(raw)
      hold=should_hold_answer(ans,clue)
      record={'id':'abadis-'+hashlib.sha256((url+'\n'+ans).encode()).hexdigest()[:24],
       'clue':clean_clue(clue),'source_clue_raw':clue,'answer':ans,'letters':len(ans),
       'source':'آبادیس','source_url':url,'page':pg,'letter':letter,
       'reviewed':False,'status':'unreviewed','hold_reason':hold}
      candidates.append(record)
     except (HTTPError,URLError,ValueError,TimeoutError) as exc:
      issues.append({'letter':letter,'url':url,'error':str(exc)[:120]})
      if isinstance(exc,HTTPError) and exc.code in (403,429):raise PermissionError('Site access restricted; stopping')
  except Exception as exc:
   problem=str(exc)[:200]
   rows.append({'letter':letter,'exact':False,'error':problem}) if not any(x['letter']==letter for x in rows) else rows[-1].update({'exact':False,'error':problem})
   issues.append({'letter':letter,'error':problem})
   if 'disallowed' in problem or 'restricted' in problem:break
  print(json.dumps({'letter':letter,'progress':rows[-1],'pairs':len(candidates)},ensure_ascii=False),flush=True)
 payload={'schema':1,'generated_at':datetime.now(timezone.utc).isoformat(),'group':a.group,
  'letters':letters,'inventory':rows,'items':candidates,'issues':issues[:80],
  'request_count':total_requests,'policy':'Inventory and limited sampling, attribution required. Candidates unreviewed. Do not auto-publish or overwrite any bank.'}
 with open(a.out,'w',encoding='utf-8') as f:json.dump(payload,f,ensure_ascii=False,indent=2)
 print(json.dumps({'group':a.group,'requests':total_requests,'letters_finished':len(rows),'candidates':len(candidates),'held':sum(bool(x['hold_reason']) for x in candidates),'issues':len(issues)},ensure_ascii=False),flush=True)
 return 0 if len(rows)>=1 else 2
if __name__=='__main__':sys.exit(main())
