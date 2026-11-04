#!/usr/bin/env python3
"""Small, attributed, non-destructive Abadis sampling (no bank or credentials in git)."""
import argparse, hashlib, json, re, sys, time, unicodedata
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from urllib.parse import quote, urljoin, urlparse
from urllib.request import urlopen, Request
from urllib.robotparser import RobotFileParser

SITE='https://abadis.ir'
UA='JadvalStudioResearch/0.1 (polite, user-directed crossword sample)'

class Pars(HTMLParser):
 def __init__(self):
  super().__init__();self.links=[];self.cur=None;self.buf=[];self.text=[]
 def flush(self):
  if self.buf:
   s=unescape(''.join(self.buf)).strip()
   self.text.extend(t.strip() for t in s.splitlines() if t.strip());self.buf=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a':self.cur=[dict(attrs).get('href',''),[]]
  if tag in ('h1','h2','h3','p','div','section','br'):self.flush()
 def handle_data(self,data):
  self.buf.append(data)
  if self.cur:self.cur[1].append(data)
 def handle_endtag(self,tag):
  if tag=='a' and self.cur:
   self.links.append((self.cur[0],unescape(''.join(self.cur[1])).strip()));self.cur=None
  if tag in ('h1','h2','h3','p','div','section'):self.flush()

def parse_listing(html):
 p=Pars();p.feed(html);p.flush();seen=set();out=[]
 for href,label in p.links:
  u=urljoin(SITE,href)
  if urlparse(u).hostname!='abadis.ir' or not urlparse(u).path.startswith('/fatofa/') or not label or u in seen:continue
  seen.add(u);out.append((label,u))
 return out

def comparable(s):
 s=unicodedata.normalize('NFKC',s).translate(str.maketrans({'آ':'ا','أ':'ا','إ':'ا','ي':'ی','ك':'ک'}))
 return ''.join(c for c in s if c.isalnum())

def parse_answer(html, clue):
 from difflib import SequenceMatcher
 p=Pars();p.feed(html);p.flush()
 lines=[re.sub(r'\s+',' ',s).strip() for s in p.text]
 for i,s in enumerate(lines):
  if s=='جدول کلمات':
   vals=[]
   for nxt in lines[i+1:i+12]:
    if nxt.startswith('پیشنهاد کاربران') or nxt.startswith('دیکشنری آبادیس'):break
    if nxt and nxt!='* * *':vals.append(nxt)
   if not vals:return ''
   if len(vals)>=2 and SequenceMatcher(None,comparable(vals[0]),comparable(clue)).ratio()>.74:
    return vals[1]
   return vals[0]
 return ''

def word(s):
 s=unicodedata.normalize('NFKC',s).translate(str.maketrans({'ي':'ی','ى':'ی','ك':'ک','ة':'ه','ۀ':'ه','أ':'ا','إ':'ا'}))
 return ''.join(c for c in re.sub(r'[\u064b-\u065f\u0670\s\u200c\u200d\-\u0640]+','',s) if c.isalpha())

def get(url,delay):
 time.sleep(delay)
 with urlopen(Request(quote(url,safe=':/?&=%#'),headers={'User-Agent':UA,'Accept':'text/html','Accept-Language':'fa'}),timeout=20) as r:
  if r.status!=200 or 'html' not in r.headers.get('Content-Type',''):raise ValueError('Invalid HTTP response')
  return r.read(800000).decode('utf-8','replace')

def main():
 p=argparse.ArgumentParser()
 p.add_argument('--letters',default='ا,ب,م,ی')
 p.add_argument('--per-letter',type=int,default=20)
 p.add_argument('--delay',type=float,default=1.3)
 p.add_argument('--out',default='abadis-sample.json')
 a=p.parse_args(); letters=[s.strip() for s in a.letters.split(',') if s.strip()]
 if not (1<=len(letters)<=8 and 1<=a.per_letter<=50 and a.delay>=0.8):raise SystemExit('Unsafe request budget')
 rp=RobotFileParser();rp.set_url(SITE+'/robots.txt');rp.read()
 if not rp.can_fetch(UA,SITE+'/crossword/?ch=%D8%A7') or not rp.can_fetch(UA,SITE+'/fatofa/test/'):
  raise SystemExit('Robots permissions not available; no automated extraction')
 stats={'list_pages':0,'detail_pages':0,'candidates':0,'errors':0,'missing_answer':0}
 out=[];issues=[];seen=set()
 for letter in letters:
  listing_url=SITE+'/crossword/?ch='+quote(letter)
  try:links=parse_listing(get(listing_url,a.delay));stats['list_pages']+=1
  except Exception as e:
   stats['errors']+=1;issues.append({'url':listing_url,'error':str(e)[:160]});continue
  for clue,url in links[:a.per_letter]:
   if url in seen:continue
   seen.add(url)
   try:
    raw=parse_answer(get(url,a.delay),clue);stats['detail_pages']+=1
    ans=word(raw)
    if not 2<=len(ans)<=30:
     stats['missing_answer']+=1;continue
    clue=re.sub(r'\s+',' ',clue).strip()
    uid=hashlib.sha256((clue+'\n'+ans).encode()).hexdigest()[:24]
    out.append({'id':'abadis-'+uid,'clue':clue,'source_clue_raw':clue,
      'answer':ans,'letters':len(ans),'reviewed':False,'status':'unreviewed',
      'source':'آبادیس','source_url':url,'license':'attribution-required'})
    stats['candidates']+=1
   except Exception as e:
    stats['errors']+=1;issues.append({'url':url,'error':str(e)[:160]})
 payload={'schema':1,'source':SITE+'/crossword/',
  'generated_at':datetime.now(timezone.utc).isoformat(),
  'policy':'Unreviewed sample; no rewriting clues or reversing word order; do not publish unreviewed entries',
  'stats':stats,'items':out,'errors':issues[:80]}
 with open(a.out,'w',encoding='utf-8') as f:json.dump(payload,f,ensure_ascii=False,indent=2)
 print(json.dumps({'stats':stats,'errors':issues[:5]},ensure_ascii=False))
 return 0 if out else 2
if __name__=='__main__':sys.exit(main())
