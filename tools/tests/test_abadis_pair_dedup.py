"""Regression tests: never deduplicate by answer alone. Synthetic data only."""
import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from abadis_prepare_import import prepare, norm, HEADERS

SOURCE="https://abadis.ir/fatofa/example/"

def row(id,clue,answer):
    return {'شناسه':id,'سرنخ':clue,'پاسخ نرمال':answer}

def entry(id,clue,answer,quality_flags=None):
    return {'id':id,'clue':clue,'answer':answer,
            'display_answer':answer,'source_url':SOURCE,
            'source_page':1,'source_index':1,'quality_flags':quality_flags or []}

class PairDedupTests(unittest.TestCase):
    def test_same_answer_with_different_clues_is_kept(self):
        old=[row('old','میوهٔ سرخ','سیب')]
        items=[entry('one','میوهٔ سرخ','سیب'),
               entry('two','میوهٔ سبز','سیب'),
               entry('three','میوهٔ خوشمزه','سیب'),
               entry('four','میوهٔ سبز','گلابی'),
               entry('five','میوهٔ سبز','سیب')]
        m,q,d,stats=prepare(items,old,[], 'example')
        self.assertEqual((len(m),len(q),len(d)),(3,0,2))
        self.assertEqual(stats['new_pairs_using_existing_answers'],2)
        self.assertEqual(stats['answers_with_multiple_new_clues'],1)
        self.assertEqual([r[4] for r in m],['میوهٔ سبز','میوهٔ خوشمزه','میوهٔ سبز'])
    def test_normalization_catches_orthographic_duplicate(self):
        old=[row('old','كشور زيبا','ايران')]
        m,q,d,_=prepare([entry('new','کشور زیبا','ایران')],old,[],'example')
        self.assertEqual(len(d),1)
        self.assertEqual(len(m)+len(q),0)
    def test_ambiguous_answers_are_both_preserved_for_review(self):
        entries=[entry('a','حکومت','دولت',['ambiguous_answers']),
                 entry('b','حکومت','امارت',['ambiguous_answers'])]
        m,q,d,stats=prepare(entries,[],[],'example')
        self.assertEqual(len(m),0)
        self.assertEqual(len(q),2)
        self.assertEqual(len(d),0)
    def test_batching_1000(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp=Path(tmp)
            for name,rows in [('main',[]),('review',[])]:
                with (tmp/(name+'.csv')).open('w',encoding='utf-8-sig',newline='') as f:
                    w=csv.DictWriter(f,fieldnames=HEADERS);w.writeheader();w.writerows(rows)
            letters='ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'
            def encode(n):
                n+=1
                out=''
                while n:
                    n,r=divmod(n-1,len(letters))
                    out=letters[r]+out
                return out
            items=[entry(f'i{i}',f'سرنخ نمونه {encode(i)} با توصیف متفاوت','واژه') for i in range(1005)]
            art=tmp/'art.json';art.write_text(json.dumps({'source':'https://abadis.ir/crossword/','items':items},ensure_ascii=False),encoding='utf8')
            prefix=str(tmp/'batch')
            out=subprocess.check_output([sys.executable,str(ROOT/'abadis_prepare_import.py'),
              '--main',str(tmp/'main.csv'),'--review',str(tmp/'review.csv'),
              '--artifact',str(art),'--out-prefix',prefix,'--batch-size','1000'],text=True)
            result=json.loads(out)
            self.assertEqual(result['metrics']['new_pairs'],1005)
            self.assertEqual(result['metrics']['answers_with_multiple_new_clues'],1)
            counts=[]
            for p in result['outputs']['main']+result['outputs']['review']:
                with open(p,encoding='utf-8-sig',newline='') as f:
                    counts.append(sum(1 for _ in csv.reader(f))-1)
            self.assertEqual(sum(counts),1005)
            self.assertTrue(all(n<=1000 for n in counts))
if __name__=='__main__':
    unittest.main()
