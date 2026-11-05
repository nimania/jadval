import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from abadis_sprint import sprint

def fake_runner(specs):
    calls=[]
    def run(**kwargs):
        i=len(calls)
        calls.append(kwargs)
        spec=specs[i]
        n=spec.get('details',0)
        assert n<=kwargs['max_details']
        part={
            'source':'https://abadis.ir/crossword/',
            'initial_cursor':{'letter':kwargs['letter'],'page':kwargs['page'],'offset':kwargs['offset']},
            'next_cursor':{'letter':kwargs['letter'],'page':spec.get('page',2),'offset':0},
            'meta':{'status':spec['status'],'detail_requests':n,
                    'index_requests':3,'quarantined':0,'failures':0},
            'items':[{'clue':f'سرنخ {i}-{j}','answer':'سیب'} for j in range(n)],
            'pending_pages':[], 'errors':[]
        }
        return part,spec.get('exitcode',0)
    return run,calls

class SprintTests(unittest.TestCase):
    def run_sprint(self,specs,max_details=150,max_letters=8):
        runner,calls=fake_runner(specs)
        with tempfile.TemporaryDirectory() as tmp:
            result,code=sprint(letter='ا',page=1,offset=0,
              max_details=max_details,max_pages=8,max_letters=max_letters,
              delay=2,out=Path(tmp)/'result.json',runner=runner)
        return result,code,calls

    def test_fills_budget_across_letters_and_preserves_gaps(self):
        art,code,calls=self.run_sprint([
          {'status':'unknown_empty_page','details':50},
          {'status':'unknown_empty_page','details':50},
          {'status':'limit_reached','details':50}])
        self.assertEqual(code,0)
        self.assertEqual([x['letter'] for x in calls],['ا','ب','پ'])
        self.assertEqual([x['max_details'] for x in calls],[150,100,50])
        self.assertEqual(art['meta']['detail_requests'],150)
        self.assertEqual(len(art['pending_pages']),2)
        self.assertEqual(len(art['items']),150)
        self.assertEqual(art['next_cursor']['letter'],'پ')

    def test_rate_limited_stops_without_switch(self):
        art,code,calls=self.run_sprint([
            {'status':'rate_limited_or_forbidden','details':4,'exitcode':2}])
        self.assertEqual(code,2)
        self.assertEqual(len(calls),1)
        self.assertEqual(art['meta']['status'],'source_blocked_or_error')
        self.assertEqual(art['next_cursor']['letter'],'ا')

    def test_respects_max_letter_switches(self):
        art,code,calls=self.run_sprint([
           {'status':'unknown_empty_page','details':0},
           {'status':'unknown_empty_page','details':0}],max_letters=2)
        self.assertEqual(code,0)
        self.assertEqual(art['meta']['status'],'letter_switch_budget_reached')
        self.assertEqual(art['next_cursor']['letter'],'پ')
        self.assertEqual(len(art['pending_pages']),2)

    def test_end_of_alphabet_does_not_claim_completion(self):
        runner,calls=fake_runner([{'status':'unknown_empty_page','details':0}])
        with tempfile.TemporaryDirectory() as tmp:
            art,code=sprint(letter='ی',page=1,offset=0,max_details=150,
               max_pages=8,max_letters=8,delay=2,out=Path(tmp)/'end.json',runner=runner)
        self.assertEqual(code,0)
        self.assertEqual(len(calls),1)
        self.assertEqual(art['meta']['status'],'alphabet_exhausted_with_pending_pages')
        self.assertEqual(art['next_cursor']['letter'],'ی')

if __name__=='__main__': unittest.main()
