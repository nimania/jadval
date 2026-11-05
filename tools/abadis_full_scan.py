#!/usr/bin/env python3
"""Resume-safe bounded Abadis scan: all 50 listing items, never writes private bank."""
import argparse, hashlib, json, re, sys, time
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.robotparser import RobotFileParser
from abadis_expand_batch import SITE, UA, fetch, listing, normal, section_answers
from abadis_prepare_import import norm as pair_norm

def risks(clue, display, all_answers):
    flags=[]
    if any(len(t)==1 and t!='و' for t in clue.split()):flags.append('split_clue')
    if len(clue)>110:flags.append('long_clue')
    if len(all_answers)>1:flags.append('ambiguous_answers')
    if len(display.split())>1:flags.append('multiword_answer')
    return flags

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--letter',required=True)
    p.add_argument('--page',type=int,default=1)
    p.add_argument('--offset',type=int,default=0)
    p.add_argument('--max-pages',type=int,default=2)
    p.add_argument('--max-details',type=int,default=60)
    p.add_argument('--delay',type=float,default=2.0)
    p.add_argument('--out',required=True)
    a=p.parse_args()
    if (len(a.letter)!=1 or not 1<=a.page<=20000 or not 0<=a.offset<50
        or not 1<=a.max_pages<=8 or not 1<=a.max_details<=150 or a.delay<1.8):
        raise SystemExit('Invalid/unsafe scan bounds')
    robots=RobotFileParser();robots.set_url(SITE+'/robots.txt');robots.read()
    if not robots.can_fetch(UA,SITE+'/crossword/?ch=%D8%A7') or not robots.can_fetch(UA,SITE+'/fatofa/test/'):
        raise SystemExit('Robots permission missing')
    started=time.monotonic()
    out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
    cursor={'letter':a.letter,'page':a.page,'offset':a.offset}
    record={'schema':3,'source':SITE+'/crossword/',
      'started_at':datetime.now(timezone.utc).isoformat(),
      'initial_cursor':dict(cursor),'next_cursor':dict(cursor),
      'meta':{'detail_requests':0,'index_requests':0,'candidates':0,'quarantined':0,
              'failures':0,'status':'running','lookahead_hits':0,'missing_index_pages':0,
              'detail_rejections':0,'elapsed_seconds':0},
      'items':[],'errors':[],'pending_pages':[]}
    seen=set()
    preloaded_listings={}
    def checkpoint(status=None):
        if status:record['meta']['status']=status
        record['meta']['candidates']=len(record['items'])
        record['meta']['elapsed_seconds']=round(time.monotonic()-started,2)
        record['next_cursor']=dict(cursor)
        record['saved_at']=datetime.now(timezone.utc).isoformat()
        tmp=out.with_suffix('.tmp')
        tmp.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
        tmp.replace(out)
    try:
        for page in range(a.page,a.page+a.max_pages):
            cursor.update({'page':page,'offset':a.offset if page==a.page else 0})
            index_url=SITE+'/crossword/?ch='+quote(a.letter)+(('&pn='+str(page)) if page>1 else '')
            if not robots.can_fetch(UA,index_url):
                checkpoint('blocked_robots_index');break
            if page in preloaded_listings:
                links=preloaded_listings.pop(page)
                record['meta']['lookahead_hits']+=1
            else:
                try:
                    html=fetch(index_url,a.delay)
                    record['meta']['index_requests']+=1
                    links=listing(html)
                except (HTTPError,URLError,ValueError,TimeoutError) as e:
                    record['errors'].append({'page':page,'stage':'index','error':str(e)[:160]})
                    checkpoint('index_error');break
                if not links:
                    # One ordinary delayed retry; never bypass forbidden/rate-limited access.
                    try:
                        html=fetch(index_url,a.delay+1.5)
                        record['meta']['index_requests']+=1
                        links=listing(html)
                    except (HTTPError,URLError,ValueError,TimeoutError) as e:
                        record['errors'].append({'page':page,'stage':'index_retry','error':str(e)[:160]})
                        checkpoint('index_error');break
            if not links:
                # One-page look-ahead distinguishes a missing index page from
                # an apparently ended alphabet. This does NOT mark the gap complete.
                following=page+1
                following_url=SITE+'/crossword/?ch='+quote(a.letter)+'&pn='+str(following)
                if following<=20000 and robots.can_fetch(UA,following_url):
                    try:
                        later_html=fetch(following_url,a.delay+1.5)
                        record['meta']['index_requests']+=1
                        later_links=listing(later_html)
                    except (HTTPError,URLError,ValueError,TimeoutError) as e:
                        record['errors'].append({'page':page,'stage':'lookahead','error':str(e)[:160]})
                        checkpoint('index_error');break
                    if later_links:
                        if len(later_links)>50:
                            checkpoint('listing_format_changed');break
                        record['pending_pages'].append({'letter':a.letter,'page':page,
                            'reason':'blank twice but next page has links','verified_next_page':following})
                        record['meta']['missing_index_pages']+=1
                        record['errors'].append({'page':page,'stage':'index','error':'recoverable_gap_next_page_has_links'})
                        preloaded_listings[following]=later_links
                        cursor.update({'page':following,'offset':0})
                        checkpoint()
                        continue
                record['errors'].append({'page':page,'stage':'index','error':'two empty responses; lookahead also empty; EOF not proven'})
                checkpoint('unknown_empty_page');break
            if len(links)>50:
                checkpoint('listing_format_changed');break
            start=a.offset if page==a.page else 0
            for i in range(start,len(links)):
                clue,url=links[i]
                cursor.update({'page':page,'offset':i})
                if record['meta']['detail_requests']>=a.max_details:
                    checkpoint('limit_reached');return 0
                if not robots.can_fetch(UA,url):
                    checkpoint('blocked_robots_detail');return 2
                try:
                    body=fetch(url,a.delay)
                    record['meta']['detail_requests']+=1
                    answers,err=section_answers(body,clue)
                    if err:
                        record['meta']['detail_rejections']+=1
                        record['errors'].append({'page':page,'index':i,'url':url,'error':err})
                    else:
                        for display in answers:
                            answer=normal(display)
                            if answer==normal(clue):continue
                            key=(pair_norm(clue),answer)
                            if key in seen:continue
                            seen.add(key)
                            flags=risks(clue,display,answers)
                            record['items'].append({
                              'id':'abadis3-'+hashlib.sha256((clue+'\n'+answer).encode()).hexdigest()[:22],
                              'clue':clue,'raw_clue':clue,'answer':answer,
                              'display_answer':display,'letters':len(answer),
                              'source':'آبادیس','source_url':url,'index_url':index_url,
                              'source_letter':a.letter,'source_page':page,'source_index':i,
                              'reviewed':False,'quality_flags':flags,
                              'review_status':'needs_review' if flags else 'unreviewed',
                              'license':'attribution-required'})
                            if flags:record['meta']['quarantined']+=1
                except HTTPError as e:
                    record['meta']['failures']+=1
                    record['errors'].append({'page':page,'index':i,'url':url,'error':f'HTTP {e.code}'})
                    checkpoint('rate_limited_or_forbidden' if e.code in (403,429,503) else 'detail_error_retry_required')
                    return 2
                except (URLError,ValueError,TimeoutError) as e:
                    record['meta']['failures']+=1
                    record['errors'].append({'page':page,'index':i,'url':url,'error':str(e)[:160]})
                    checkpoint('detail_error_retry_required')
                    return 2
                cursor.update({'page':page,'offset':i+1})
                if i+1==len(links):cursor.update({'page':page+1,'offset':0})
                if i%5==4:checkpoint()
            checkpoint()
        else:checkpoint('page_budget_reached')
    finally:
        if record['meta']['status']=='running':checkpoint('interrupted')
        else:checkpoint()
    print(json.dumps({'cursor':record['next_cursor'],'stats':record['meta']},ensure_ascii=False))
    return 0

if __name__=='__main__':sys.exit(main())
