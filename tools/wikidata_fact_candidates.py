#!/usr/bin/env python3
"""Build review-only Persian crossword clue candidates from Wikidata structured facts.

Queries only country capitals (P36) and currencies (P38); ambiguous multi-value
claims are skipped. No generated clue is approved or published automatically.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import unicodedata

USER_AGENT = 'JadvalCrosswordStaging/0.1 (https://github.com/nimania/jadval; public dataset research)'
ENDPOINT = 'https://query.wikidata.org/sparql'
FIELDS = {
    'capital': ('P36', 'پایتخت {country}', 'جغرافیا'),
    'currency': ('P38', 'واحد پول {country}', 'اطلاعات عمومی'),
}
VALID_LETTERS = re.compile(r'^[\u0621-\u063a\u0641-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc\u0622]+$')
SPACE = re.compile(r'[\s\u200c\u200d\-]+')
DIACRITICS = re.compile(r'[\u064b-\u065f\u0670\u0640]')

def norm(text):
    text=unicodedata.normalize('NFKC',text).translate(str.maketrans({'ي':'ی','ى':'ی','ك':'ک'}))
    return SPACE.sub('',DIACRITICS.sub('',text))

def valid(text,min_letters=3,max_letters=20):
    return min_letters<=len(text)<=max_letters and bool(VALID_LETTERS.fullmatch(text))

def qid(url):
    match=re.search(r'/Q[0-9]+$',url)
    if not match:raise ValueError('Unexpected Wikidata item URI')
    return url.rsplit('/',1)[1]

def query_string(prop):
    if prop not in ('P36','P38'):raise ValueError('Unexpected property')
    return '''SELECT ?country ?countryLabel ?answer ?answerLabel WHERE {
      ?country <http://www.wikidata.org/prop/direct/P31> <http://www.wikidata.org/entity/Q6256> ;
               <http://www.wikidata.org/prop/direct/''' + prop + '''> ?answer .
      ?country <http://www.w3.org/2000/01/rdf-schema#label> ?countryLabel .
      ?answer  <http://www.w3.org/2000/01/rdf-schema#label> ?answerLabel .
      FILTER(LANG(?countryLabel) = "fa")
      FILTER(LANG(?answerLabel) = "fa")
    } LIMIT 1500'''

def fetch_rows(prop,timeout=55):
    url=ENDPOINT+'?'+urlencode({'query':query_string(prop),'format':'json'})
    req=Request(url,headers={'Accept':'application/sparql-results+json','User-Agent':USER_AGENT})
    with urlopen(req,timeout=timeout) as response:
        data=json.load(response)
    return [{
        'country_id':qid(b['country']['value']),
        'country':b['countryLabel']['value'],
        'answer_id':qid(b['answer']['value']),
        'answer':b['answerLabel']['value'],
    } for b in data['results']['bindings']]

def generate(rows,property_code,template,category):
    grouped=defaultdict(dict)
    for r in rows:
        grouped[r['country_id']][r['answer_id']]=r
    out=[];stats=Counter()
    for country_id,answers in sorted(grouped.items()):
        if len(answers)!=1:
            stats['multiple_answers_omitted']+=1
            continue
        row=next(iter(answers.values()))
        country=norm(row['country']);answer=norm(row['answer'])
        if not valid(country,2,45) or not valid(answer,3,20):
            stats['non_persian_or_length_omitted']+=1
            continue
        clue=template.format(country=row['country'])
        key=property_code+':'+country_id+':'+row['answer_id']
        ident='wd-'+hashlib.sha256(key.encode('utf8')).hexdigest()[:20]
        out.append({
            'candidate_id':ident,'answer':answer,'answer_display':row['answer'],
            'letters':len(answer),'clue':clue,'category':category,
            'difficulty':'unknown','status':'needs_review','reviewed':False,
            'source_id':'wikidata:'+country_id+':'+property_code,
            'source_url':'https://www.wikidata.org/wiki/'+country_id,
            'answer_entity_url':'https://www.wikidata.org/wiki/'+row['answer_id'],
            'source_kind':'structured_relationship','property_id':property_code,
            'license':'CC0','verification':'not_verified',
            'notes':'Wikidata statement candidate; verify current validity and Persian phrasing.'
        })
        stats['generated']+=1
    return out,dict(stats)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',required=True)
    args=p.parse_args()
    out=Path(args.output);report_path=out.with_suffix('.report.json')
    if out.exists() or report_path.exists():raise FileExistsError('Existing output will not be overwritten.')
    all_candidates=[];report={'source':'Wikidata SPARQL','source_license':'CC0',
                            'created_at_utc':datetime.now(timezone.utc).isoformat(),
                            'properties':{},'approved_count':0}
    for kind,(prop,template,category) in FIELDS.items():
        rows=fetch_rows(prop)
        candidates,stats=generate(rows,prop,template,category)
        report['properties'][kind]={'source_rows':len(rows),**stats}
        all_candidates.extend(candidates)
    unique={(x['answer'],x['clue']):x for x in all_candidates}
    results=sorted(unique.values(),key=lambda x:(x['letters'],x['answer'],x['clue']))
    report['candidate_pairs']=len(results)
    report['distinct_answers']=len({x['answer'] for x in results})
    report['warning']='Fact candidates, not reviewed answers: must be checked before any production use.'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(''.join(json.dumps(e,ensure_ascii=False,sort_keys=True)+'\n' for e in results),encoding='utf8')
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
