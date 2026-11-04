#!/usr/bin/env python3
"""Bounded, courteous Abadis crossword extraction.
Writes only JSON artifacts. Never edits/reads the user's private word bank.
Designed for explicit per-batch runs; not a periodic crawler.
"""
import argparse, hashlib, json, re, sys, time, unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.robotparser import RobotFileParser

SITE='https://abadis.ir'
UA='JadvalCrosswordResearch/0.2 (attributed limited academic-style extraction)'
GROUPS=[
  'ا ب پ خ'.split(),
  'د ر ص ض'.split(),
  'ط ظ ع گ'.split(),
  'ل م ت ث ج چ ح ذ ز ژ س ش غ ف ق ک ن و ه ی'.split(),
]
# Pages intentionally spread over the index rather than only page 1.
PAGE_SETS={0:[1,2,3,5,10,20,40,80],1:[1,2,3,5,10,20,40,80],
           2:[1,2,3,5,10,20,40,80],3:[1,2,3,5,10,20,40,80]}
class LinkParser(HTMLParser):
 def __init__(self):
  super().__init__();self.links=[];self.current=None
 def handle_starttag(self,tag,attrs):
  if tag=='a':self.current=[dict(attrs).get('href',''),[]]
 def handle_data(self,s):
  if self.current:self.current[1].append(s)
 def handle_endtag(self,tag):
  if tag=='a' and self.current:
   self.links.append((self.current[0],''.join(self.current[1]).strip()))
   self.current=None

def listing(html):
 p=LinkParser();p.feed(html);seen=set();res=[]
 for href,title in p.links:
  url=urljoin(SITE,href)
  if urlparse(url).hostname not in ('abadis.ir','www.abadis.ir'):continue
  if not urlparse(url).path.startswith('/fatofa/'):continue
  title=re.sub(r'\s+',' ',title).strip()
  if not title or url in seen:continue
  seen.add(url);res.append((title,url))
 return res

def normal(s):
 s=unicodedata.normalize('NFKC',str(s)).translate(str.maketrans({'ي':'ی','ى':'ی','ك':'ک','ة':'ه','ۀ':'ه','أ':'ا','إ':'ا'}))
 s=re.sub(r'[\u064b-\u065f\u0670\u0640\u200c\u200d\s\-]+','',s)
 return ''.join(c for c in s if c.isalpha())

def candidate_answer(s):
 s=re.sub(r'\s+',' ',s.strip(' []()"“”«»\u200c'))
 if not s or re.search(r'[\d۰-۹؛؛:!?؟\n]',s):return False
 if len(s)>65 or len(s.split())>4:return False
 w=normal(s)
 if not 2<=len(w)<=30:return False
 if len(w)>=6 and len(w)%2==0 and w[:len(w)//2]==w[len(w)//2:]:return False
 return True

def section_answers(html, clue=''):
 """Only accept text under real heading «جدول کلمات», never dictionary prose."""
 from bs4 import BeautifulSoup, Tag, NavigableString
 soup=BeautifulSoup(html,'html.parser')
 h=next((x for x in soup.find_all(['h2','h3','h4'])
         if x.get_text(' ',strip=True).replace(' ','')=='جدولکلمات'),None)
 if h is None:return [],'no_crossword_heading'
 parts=[]
 # Answers can be nested in a different wrapper than the heading itself.
 # Walk following text nodes until the next heading, not next_siblings.
 for el in h.next_elements:
  if isinstance(el,Tag) and el.name in ('h1','h2','h3','h4'):break
  if not isinstance(el,NavigableString):continue
  t=re.sub(r'\s+',' ',str(el)).strip()
  if t and t!='جدول کلمات':parts.append(t)
  if sum(map(len,parts))>420:break
 raw=' '.join(parts).strip()
 if not raw:return [],'empty_crossword_section'
 # Some pages echo their own heading before actual answer (e.g. «آبکی شل»).
 # Remove complete matching heading tokens, never reverse or guess word order.
 clue_words=str(clue).split()
 answer_words=raw.split()
 def equaltoken(t):return normal(t).replace('آ','ا')
 if clue_words and len(answer_words)>len(clue_words) and all(
  equaltoken(a)==equaltoken(b) for a,b in zip(clue_words,answer_words[:len(clue_words)])
 ):
  raw=' '.join(answer_words[len(clue_words):])
 if len(raw)>420:return [],'long_dictionary_prose'
 # Prefer comma separated answers, but never fuse several dictionary synonyms into one fake word.
 segments=[re.sub(r'\s+',' ',s).strip() for s in re.split(r'[,،;؛|]',raw)]
 if len(segments)>10:return [],'too_many_synonyms'
 good=[s for s in segments if candidate_answer(s)]
 if not good:return [],'no_valid_answer'
 # Don't pass contradictory sections with lots of rejected prose.
 if len(good)<len(segments)/2:return [],'prose_mixed_with_answers'
 dedup=[];seen=set()
 for s in good:
  w=normal(s)
  if w not in seen:seen.add(w);dedup.append(s)
 return dedup,None

def fetch(url,delay):
 time.sleep(delay)
 req=Request(quote(url,safe=':/?&=%#'),headers={'User-Agent':UA,'Accept':'text/html','Accept-Language':'fa'})
 with urlopen(req,timeout=13) as r:
  if r.status!=200 or 'html' not in r.headers.get('Content-Type',''):raise ValueError('Not HTML response')
  return r.read(1300000).decode('utf-8','replace')

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--group',type=int,required=True,choices=range(4))
 ap.add_argument('--per-letter',type=int,default=30)
 ap.add_argument('--delay',type=float,default=1.7)
 ap.add_argument('--pages',default='',help='Comma-separated index pages for later batches, max 8 distinct pages')
 ap.add_argument('--out',required=True)
 args=ap.parse_args()
 if args.per_letter>35 or args.per_letter<2 or args.delay<1.5:raise SystemExit('Unsafe request budget')
 if args.pages and not re.fullmatch(r'[0-9]+(?:,[0-9]+){0,7}',args.pages):raise SystemExit('Invalid page list')
 requested_pages=list(dict.fromkeys(int(n) for n in args.pages.split(',') if n))
 if any(p<1 or p>128 for p in requested_pages):raise SystemExit('Index page outside safe range')
 rp=RobotFileParser();rp.set_url(SITE+'/robots.txt');rp.read()
 if not (rp.can_fetch(UA,SITE+'/crossword/?ch=%D8%A7') and rp.can_fetch(UA,SITE+'/fatofa/test/')):
  raise SystemExit('Robots permission denied/unknown')
 items=[];log=[];seen=set();probed=0;details=0;site_error=None
 for letter in GROUPS[args.group]:
  letter_entries=[];num=0;miss=0
  pages=requested_pages if requested_pages else (PAGE_SETS[args.group] if letter in 'ا ب پ خ د ر ص ض ط ظ ع گ ل م'.split() else [1])
  for pg in pages:
   if num>=args.per_letter or site_error:break
   url=SITE+'/crossword/?ch='+quote(letter)+(('&pn='+str(pg)) if pg>1 else '')
   if not rp.can_fetch(UA,url):site_error='robots_disallowed';break
   try:
    html=fetch(url,args.delay);probed+=1;links=listing(html)
   except (HTTPError,URLError,ValueError,TimeoutError) as e:
    log.append({'letter':letter,'page':pg,'problem':str(e)[:130]})
    if isinstance(e,HTTPError) and e.code in (403,429,503):site_error=f'http_{e.code}'
    break
   if not links:miss+=1;continue
   # pull spread across pages; no single page or letter dominates
   limit=min(6,args.per_letter-num)
   for clue,detail_url in links[:limit]:
    if detail_url in seen or site_error:continue
    seen.add(detail_url)
    if not rp.can_fetch(UA,detail_url):continue
    try:
     html=fetch(detail_url,args.delay);details+=1
     answers,err=section_answers(html,clue)
     if err:
      log.append({'letter':letter,'url':detail_url,'problem':err})
      continue
     suspicious=bool(re.search(r'(?:^|\s)[اآ](?=\s)|\s{2,}',clue)) or len(re.findall(r'(?<!\S)\S(?!\S)',clue))>1
     for answer in answers:
      w=normal(answer)
      if w==normal(clue):continue
      key=(normal(clue),w)
      record={'id':'abadis-'+hashlib.sha256((clue+'\n'+w).encode()).hexdigest()[:22],
       'clue':clue,'answer':w,'answer_display':answer,'letters':len(w),
       'source':'آبادیس','source_url':detail_url,'source_index':url,'source_page':pg,
       'reviewed':False,'source_clue_raw':clue,'needs_clue_review':suspicious,
       'needs_answer_review':len(answers)>1 or len(answer.split())>1,
       'review_status':'unreviewed','license':'attribution-required'}
      items.append(record)
    except (HTTPError,URLError,ValueError,TimeoutError) as e:
     log.append({'letter':letter,'url':detail_url,'problem':str(e)[:130]})
     if isinstance(e,HTTPError) and e.code in (403,429,503):site_error=f'http_{e.code}';break
    num+=1
  print(json.dumps({'letter':letter,'pages_attempted':len(pages),'details_so_far':details,'pairs_so_far':len(items),'site_error':site_error},ensure_ascii=False),flush=True)
  # Persist after each letter, so a timeout or site limitation never loses prior work.
  snapshot={'schema':2,'source':SITE,'generated_at':datetime.now(timezone.utc).isoformat(),
   'group':args.group,'letters':GROUPS[args.group],
   'meta':{'index_pages_read':probed,'detail_pages_read':details,'pair_count':len(items),
    'source_errors':len(log),'site_error':site_error,'checkpoint':True,'review_required':True},
   'items':items,'errors':log[:300]}
  with open(args.out,'w',encoding='utf-8') as f:
   json.dump(snapshot,f,ensure_ascii=False,indent=2)
  if site_error:break
 # dedup within shard (no guessing/reordering clue words)
 unique={}
 for r in items:unique[(normal(r['clue']),r['answer'])]=r
 data={'schema':2,'source':SITE,'generated_at':datetime.now(timezone.utc).isoformat(),
       'group':args.group,'letters':GROUPS[args.group],
       'meta':{'index_pages_read':probed,'detail_pages_read':details,
               'pair_count':len(unique),'source_errors':len(log),'site_error':site_error,
               'review_required':True},
       'items':list(unique.values()),'errors':log[:300]}
 with open(args.out,'w',encoding='utf-8') as f:json.dump(data,f,ensure_ascii=False,indent=2)
 print(json.dumps({'group':args.group,'meta':data['meta']},ensure_ascii=False),flush=True)
 return 0 if items else 2
if __name__=='__main__':sys.exit(main())
