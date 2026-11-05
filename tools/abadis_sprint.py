#!/usr/bin/env python3
"""Bounded sequential multi-letter Abadis scan.

Keep a single global 150-detail budget and >=2s pacing. Never bypass robots or
rate limits. Empty index pages are queued for retry, not treated as end-of-data.
Only public Abadis candidate pairs enter the artifact, never the private bank.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ALPHABET='ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی'.split()
METRICS=('detail_requests','index_requests','quarantined','failures',
         'lookahead_hits','missing_index_pages','detail_rejections')

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def next_letter(letter):
    i=ALPHABET.index(letter)
    return ALPHABET[i+1] if i+1<len(ALPHABET) else None

def scan_segment(*,letter,page,offset,max_pages,max_details,delay,out):
    cmd=[sys.executable,str(Path(__file__).with_name('abadis_full_scan.py')),
         '--letter',letter,'--page',str(page),'--offset',str(offset),
         '--max-pages',str(max_pages),'--max-details',str(max_details),
         '--delay',str(delay),'--out',str(out)]
    proc=subprocess.run(cmd,check=False,capture_output=True,text=True)
    if not out.exists():
        raise RuntimeError(f'No scanner checkpoint; exit={proc.returncode}: {proc.stderr[-250:]}')
    return json.loads(out.read_text('utf-8')),proc.returncode

def sprint(*,letter,page,offset,max_details,max_pages,max_letters,delay,out,runner=scan_segment):
    if letter not in ALPHABET or page<1 or not 0<=offset<50:
        raise ValueError('Invalid cursor')
    if not 1<=max_details<=150 or not 1<=max_pages<=8:
        raise ValueError('Invalid detail/index budget')
    if not 1<=max_letters<=8 or delay<2.0:
        raise ValueError('Unsafe letter count / delay')
    out=Path(out)
    out.parent.mkdir(parents=True,exist_ok=True)
    started=time.monotonic()
    cursor={'letter':letter,'page':page,'offset':offset}
    record={
        'schema':4,'source':'https://abadis.ir/crossword/',
        'started_at':utc_now(),'initial_cursor':dict(cursor),
        'next_cursor':dict(cursor),'pending_pages':[],
        'segments':[],'items':[],'errors':[],
        'meta':{**{k:0 for k in METRICS},
                'candidates':0,'elapsed_seconds':0,'status':'running',
                'max_details':max_details,'max_letters':max_letters}
    }
    seen=set()
    def checkpoint(status=None):
        if status:record['meta']['status']=status
        record['meta']['candidates']=len(record['items'])
        record['meta']['elapsed_seconds']=round(time.monotonic()-started,2)
        record['next_cursor']=dict(cursor)
        record['saved_at']=utc_now()
        tmp=out.with_name(out.name+'.tmp')
        tmp.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
        os.replace(tmp,out)

    used=0
    for index in range(max_letters):
        remaining=max_details-used
        if remaining<=0:
            checkpoint('detail_budget_reached')
            return record,0
        segout=out.with_name(out.stem+f'.segment{index}.json')
        try:
            part,exitcode=runner(letter=cursor['letter'],page=cursor['page'],
                                 offset=cursor['offset'],max_pages=max_pages,
                                 max_details=remaining,delay=delay,out=segout)
        except Exception as exc:
            record['errors'].append({'letter':cursor['letter'],
                                     'error':'segment_failed','detail':str(exc)[:200]})
            checkpoint('segment_failed')
            return record,2
        if part.get('source')!=record['source']:
            checkpoint('unexpected_source')
            return record,2
        meta=part.get('meta',{})
        scans=int(meta.get('detail_requests',0))
        if scans<0 or scans>remaining:
            checkpoint('invalid_detail_budget')
            return record,2
        used+=scans
        for key in METRICS:
            record['meta'][key]+=meta.get(key,0)
        for item in part.get('items',[]):
            key=(item.get('clue'),item.get('answer'))
            if key not in seen:
                seen.add(key)
                record['items'].append(item)
        record['errors'].extend(part.get('errors',[]))
        status=str(meta.get('status','unknown'))
        record['segments'].append({
            'letter':cursor['letter'],'initial_cursor':part.get('initial_cursor'),
            'next_cursor':part.get('next_cursor'),'status':status,
            'detail_requests':scans,'candidates':len(part.get('items',[]))})
        record['pending_pages'].extend(part.get('pending_pages',[]))
        cursor=dict(part.get('next_cursor') or cursor)
        checkpoint()
        if exitcode!=0 or status in (
            'rate_limited_or_forbidden','blocked_robots_index',
            'blocked_robots_detail','detail_error_retry_required',
            'index_error','listing_format_changed'):
            checkpoint('source_blocked_or_error')
            return record,2
        if used>=max_details or status in ('limit_reached','detail_budget_reached'):
            checkpoint('detail_budget_reached')
            return record,0
        if status=='unknown_empty_page':
            missing={'letter':cursor['letter'],'page':cursor['page'],
                     'reason':'two empty listings, next page not confirmed',
                     'status':'retry_later'}
            if missing not in record['pending_pages']:
                record['pending_pages'].append(missing)
            following=next_letter(cursor['letter'])
            if following is None:
                checkpoint('alphabet_exhausted_with_pending_pages')
                return record,0
            cursor={'letter':following,'page':1,'offset':0}
            checkpoint('continuing_next_letter')
            continue
        checkpoint(status)
        return record,0
    checkpoint('letter_switch_budget_reached')
    return record,0

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--letter',required=True)
    p.add_argument('--page',type=int,default=1)
    p.add_argument('--offset',type=int,default=0)
    p.add_argument('--max-details',type=int,default=150)
    p.add_argument('--max-pages',type=int,default=8)
    p.add_argument('--max-letters',type=int,default=8)
    p.add_argument('--delay',type=float,default=2.0)
    p.add_argument('--out',required=True)
    a=p.parse_args()
    record,code=sprint(letter=a.letter,page=a.page,offset=a.offset,
                       max_details=a.max_details,max_pages=a.max_pages,
                       max_letters=a.max_letters,delay=a.delay,out=a.out)
    print(json.dumps({
        'status':record['meta']['status'],
        'details':record['meta']['detail_requests'],
        'candidates':len(record['items']),
        'segments':len(record['segments']),
        'pending_pages':len(record['pending_pages']),
        'next_cursor':record['next_cursor']},ensure_ascii=False))
    return code

if __name__=='__main__':sys.exit(main())
