"""Deterministic queue ordering and strict unreviewed-only safeguard."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT=Path(__file__).resolve().parents[1]/'tools'/'prepare_review_queue.py'
spec=importlib.util.spec_from_file_location('review_queue',SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def item(word):
    return {'answer':word,'letters':len(word),'status':'needs_review',
            'reviewed':False,'candidate_id':word,'answer_display':word,
            'source_id':'t','source_url':'','license':'MIT'}

class TestReviewQueue(unittest.TestCase):
    def test_unique_length_and_cap(self):
        words=['کتاب','کتاب','درخت','سیاره','شیرین','تبریز','آسمان','آباد','باران','هوا','ساعت']
        selected,n=module.distribute([item(x) for x in words],6)
        self.assertEqual(len(selected),6)
        self.assertEqual(n,len(set(words)))
        self.assertEqual(len({x['answer'] for x in selected}),6)
    def test_no_approval(self):
        data=[item('کتاب'),item('شیراز')]
        chosen,n=module.distribute(data,10)
        self.assertEqual(module.make_report(chosen,n)['reviewed_or_approved'],0)
    def test_reject_approved_input(self):
        import tempfile,json
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'source.jsonl'
            a=item('تهران');a['reviewed']=True
            p.write_text(json.dumps(a,ensure_ascii=False)+'\n',encoding='utf-8')
            with self.assertRaises(ValueError):module.load_candidates(p)

if __name__=='__main__':unittest.main()
